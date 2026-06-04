import { useEffect, useMemo, useState } from "react"
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  doc,
} from "firebase/firestore"
import {
  CalendarCheck,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  Save,
  Search,
  Sparkles,
  Users,
  XCircle,
  Coffee,
  Plane,
  Timer,
} from "lucide-react"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function Attendance() {
  const { currentUser } = useAuth()

  const today = new Date().toISOString().slice(0, 10)

  const [companies, setCompanies] = useState([])
  const [employees, setEmployees] = useState([])
  const [attendanceRecords, setAttendanceRecords] = useState([])

  const [selectedCompany, setSelectedCompany] = useState("")
  const [selectedDate, setSelectedDate] = useState(today)
  const [searchText, setSearchText] = useState("")
  const [attendanceMap, setAttendanceMap] = useState({})

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const statusOptions = [
    {
      value: "Present",
      label: "Present",
      icon: CheckCircle2,
      color: "text-green-700",
      bg: "bg-green-50",
      active: "bg-green-700 text-white border-green-700",
    },
    {
      value: "Absent",
      label: "Absent",
      icon: XCircle,
      color: "text-red-700",
      bg: "bg-red-50",
      active: "bg-red-700 text-white border-red-700",
    },
    {
      value: "Half Day",
      label: "Half Day",
      icon: Coffee,
      color: "text-yellow-700",
      bg: "bg-yellow-50",
      active: "bg-yellow-600 text-white border-yellow-600",
    },
    {
      value: "Paid Leave",
      label: "Paid Leave",
      icon: Plane,
      color: "text-blue-700",
      bg: "bg-blue-50",
      active: "bg-blue-700 text-white border-blue-700",
    },
    {
      value: "Holiday",
      label: "Holiday",
      icon: CalendarCheck,
      color: "text-purple-700",
      bg: "bg-purple-50",
      active: "bg-purple-700 text-white border-purple-700",
    },
    {
      value: "Late",
      label: "Late",
      icon: Timer,
      color: "text-orange-700",
      bg: "bg-orange-50",
      active: "bg-orange-600 text-white border-orange-600",
    },
  ]

  const getCompanyName = (companyId) => {
    const company = companies.find((item) => item.id === companyId)
    return company?.name || company?.companyName || "-"
  }

  const getStatusConfig = (status) => {
    return (
      statusOptions.find((item) => item.value === status) || statusOptions[1]
    )
  }

  const fetchData = async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const companiesQuery = query(
        collection(db, "companies"),
        where("caId", "==", currentUser.uid)
      )

      const employeesQuery = query(
        collection(db, "employees"),
        where("caId", "==", currentUser.uid)
      )

      const attendanceQuery = query(
        collection(db, "attendance"),
        where("caId", "==", currentUser.uid)
      )

      const [companiesSnapshot, employeesSnapshot, attendanceSnapshot] =
        await Promise.all([
          getDocs(companiesQuery),
          getDocs(employeesQuery),
          getDocs(attendanceQuery),
        ])

      const companyList = companiesSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      const employeeList = employeesSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      const attendanceList = attendanceSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      companyList.sort((a, b) =>
        (a.name || a.companyName || "").localeCompare(
          b.name || b.companyName || ""
        )
      )

      employeeList.sort((a, b) =>
        (a.name || a.employeeName || "").localeCompare(
          b.name || b.employeeName || ""
        )
      )

      setCompanies(companyList)
      setEmployees(employeeList)
      setAttendanceRecords(attendanceList)

      if (companyList.length > 0 && !selectedCompany) {
        setSelectedCompany(companyList[0].id)
      }
    } catch (err) {
      setError("Failed to load attendance data.")
    } finally {
      setLoading(false)
    }
  }

  const companyEmployees = useMemo(() => {
    return employees
      .filter((employee) => {
        const matchesCompany = selectedCompany
          ? employee.companyId === selectedCompany
          : false

        const employeeName =
          employee.name || employee.employeeName || employee.fullName || ""

        const matchesSearch = employeeName
          .toLowerCase()
          .includes(searchText.toLowerCase())

        const isActive = employee.isActive !== false

        return matchesCompany && matchesSearch && isActive
      })
      .sort((a, b) => {
        const nameA = a.name || a.employeeName || ""
        const nameB = b.name || b.employeeName || ""
        return nameA.localeCompare(nameB)
      })
  }, [employees, selectedCompany, searchText])

  const selectedDateRecords = useMemo(() => {
    return attendanceRecords.filter((record) => {
      return (
        record.companyId === selectedCompany &&
        (record.date === selectedDate ||
          record.attendanceDate === selectedDate)
      )
    })
  }, [attendanceRecords, selectedCompany, selectedDate])

  const summary = useMemo(() => {
    const values = Object.values(attendanceMap)

    return {
      total: companyEmployees.length,
      marked: values.filter(Boolean).length,
      present: values.filter((status) => status === "Present").length,
      absent: values.filter((status) => status === "Absent").length,
      halfDay: values.filter((status) => status === "Half Day").length,
      paidLeave: values.filter((status) => status === "Paid Leave").length,
      holiday: values.filter((status) => status === "Holiday").length,
      late: values.filter((status) => status === "Late").length,
    }
  }, [attendanceMap, companyEmployees])

  const applyExistingAttendance = () => {
    const map = {}

    companyEmployees.forEach((employee) => {
      const existingRecord = selectedDateRecords.find(
        (record) => record.employeeId === employee.id
      )

      map[employee.id] = existingRecord?.status || existingRecord?.attendanceStatus || ""
    })

    setAttendanceMap(map)
  }

  const markAttendance = (employeeId, status) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [employeeId]: status,
    }))
  }

  const markAll = (status) => {
    const updatedMap = {}

    companyEmployees.forEach((employee) => {
      updatedMap[employee.id] = status
    })

    setAttendanceMap(updatedMap)
  }

  const clearAll = () => {
    const updatedMap = {}

    companyEmployees.forEach((employee) => {
      updatedMap[employee.id] = ""
    })

    setAttendanceMap(updatedMap)
  }

  const saveAttendance = async () => {
    if (!currentUser) {
      setError("Please login first.")
      return
    }

    if (!selectedCompany) {
      setError("Please select company.")
      return
    }

    if (!selectedDate) {
      setError("Please select date.")
      return
    }

    const unmarkedEmployees = companyEmployees.filter(
      (employee) => !attendanceMap[employee.id]
    )

    if (unmarkedEmployees.length > 0) {
      const confirmSave = window.confirm(
        `${unmarkedEmployees.length} employee(s) are unmarked. Save anyway?`
      )

      if (!confirmSave) return
    }

    try {
      setSaving(true)
      setError("")
      setSuccess("")

      const operations = companyEmployees
        .filter((employee) => attendanceMap[employee.id])
        .map(async (employee) => {
          const employeeName =
            employee.name || employee.employeeName || employee.fullName || "-"

          const existingRecord = attendanceRecords.find((record) => {
            return (
              record.caId === currentUser.uid &&
              record.companyId === selectedCompany &&
              record.employeeId === employee.id &&
              (record.date === selectedDate ||
                record.attendanceDate === selectedDate)
            )
          })

          const payload = {
            caId: currentUser.uid,
            companyId: selectedCompany,
            companyName: getCompanyName(selectedCompany),
            employeeId: employee.id,
            employeeName,
            date: selectedDate,
            attendanceDate: selectedDate,
            status: attendanceMap[employee.id],
            attendanceStatus: attendanceMap[employee.id],
            updatedAt: serverTimestamp(),
            updatedAtMillis: Date.now(),
          }

          if (existingRecord) {
            await updateDoc(doc(db, "attendance", existingRecord.id), payload)
          } else {
            await addDoc(collection(db, "attendance"), {
              ...payload,
              createdAt: serverTimestamp(),
              createdAtMillis: Date.now(),
            })
          }
        })

      await Promise.all(operations)

      setSuccess("Attendance saved successfully.")
      await fetchData()
    } catch (err) {
      setError("Failed to save attendance.")
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [currentUser])

  useEffect(() => {
    applyExistingAttendance()
  }, [companyEmployees, selectedDateRecords])

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-orange-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-orange-100 px-4 py-2 rounded-full text-sm font-bold">
              <Sparkles size={16} />
              Daily Manual Attendance
            </p>

            <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">
              Attendance
            </h1>

            <p className="mt-3 text-slate-300 max-w-2xl">
              Mark employee attendance company-wise with quick bulk actions,
              smart status buttons and clean daily summaries.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-full sm:min-w-[360px]">
            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Employees</p>
              <h2 className="text-3xl font-black mt-2">{summary.total}</h2>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Marked</p>
              <h2 className="text-3xl font-black mt-2">{summary.marked}</h2>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-3xl">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-5 py-4 rounded-3xl">
          {success}
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Company
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="premium-select"
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name || company.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Attendance Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="premium-input"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Search Employee
            </label>

            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search employee name"
                className="premium-input pl-11"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mt-6">
          <button
            onClick={fetchData}
            disabled={loading}
            className="premium-button-dark"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>

          <button
            onClick={() => markAll("Present")}
            disabled={companyEmployees.length === 0}
            className="premium-button-green"
          >
            <CheckCircle2 size={18} />
            Mark All Present
          </button>

          <button
            onClick={() => markAll("Absent")}
            disabled={companyEmployees.length === 0}
            className="premium-button-red"
          >
            <XCircle size={18} />
            Mark All Absent
          </button>

          <button
            onClick={clearAll}
            disabled={companyEmployees.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-5 py-3 rounded-2xl font-bold hover:bg-slate-200 disabled:bg-slate-100 disabled:text-slate-400 transition"
          >
            Clear All
          </button>

          <button
            onClick={saveAttendance}
            disabled={saving || companyEmployees.length === 0}
            className="premium-button-primary ml-auto"
          >
            <Save size={18} />
            {saving ? "Saving..." : "Save Attendance"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4">
        <div className="bg-white/90 rounded-3xl p-5 shadow-lg border border-white/80">
          <p className="text-slate-500 text-sm">Total</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">
            {summary.total}
          </h3>
        </div>

        <div className="bg-green-50 rounded-3xl p-5 shadow-lg border border-green-100">
          <p className="text-green-700 text-sm font-bold">Present</p>
          <h3 className="text-2xl font-black text-green-800 mt-1">
            {summary.present}
          </h3>
        </div>

        <div className="bg-red-50 rounded-3xl p-5 shadow-lg border border-red-100">
          <p className="text-red-700 text-sm font-bold">Absent</p>
          <h3 className="text-2xl font-black text-red-800 mt-1">
            {summary.absent}
          </h3>
        </div>

        <div className="bg-yellow-50 rounded-3xl p-5 shadow-lg border border-yellow-100">
          <p className="text-yellow-700 text-sm font-bold">Half Day</p>
          <h3 className="text-2xl font-black text-yellow-800 mt-1">
            {summary.halfDay}
          </h3>
        </div>

        <div className="bg-blue-50 rounded-3xl p-5 shadow-lg border border-blue-100">
          <p className="text-blue-700 text-sm font-bold">Paid Leave</p>
          <h3 className="text-2xl font-black text-blue-800 mt-1">
            {summary.paidLeave}
          </h3>
        </div>

        <div className="bg-purple-50 rounded-3xl p-5 shadow-lg border border-purple-100">
          <p className="text-purple-700 text-sm font-bold">Holiday</p>
          <h3 className="text-2xl font-black text-purple-800 mt-1">
            {summary.holiday}
          </h3>
        </div>

        <div className="bg-orange-50 rounded-3xl p-5 shadow-lg border border-orange-100">
          <p className="text-orange-700 text-sm font-bold">Late</p>
          <h3 className="text-2xl font-black text-orange-800 mt-1">
            {summary.late}
          </h3>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-50 text-orange-700 rounded-2xl flex items-center justify-center">
              <Users size={24} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Employee Attendance
              </h2>
              <p className="text-slate-500 mt-1">
                {getCompanyName(selectedCompany)} | {selectedDate}
              </p>
            </div>
          </div>

          <div className="text-sm text-slate-500">
            {summary.marked} of {summary.total} marked
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-slate-500">Loading attendance...</div>
        ) : !selectedCompany ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Building2 size={34} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mt-5">
              Select a company
            </h3>
            <p className="text-slate-500 mt-2">
              Choose a company to load employee list.
            </p>
          </div>
        ) : companyEmployees.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <Users size={34} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mt-5">
              No employees found
            </h3>
            <p className="text-slate-500 mt-2">
              Add employees to this company first.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {companyEmployees.map((employee) => {
              const employeeName =
                employee.name || employee.employeeName || employee.fullName || "-"

              const selectedStatus = attendanceMap[employee.id]
              const selectedConfig = getStatusConfig(selectedStatus)

              return (
                <div key={employee.id} className="p-5 hover:bg-slate-50/80">
                  <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-orange-50 text-orange-700 rounded-2xl flex items-center justify-center shrink-0">
                        <Users size={26} />
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          {employeeName}
                        </h3>

                        <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                          {employee.designation && (
                            <span>{employee.designation}</span>
                          )}

                          {employee.phone && <span>{employee.phone}</span>}

                          {selectedStatus && (
                            <span
                              className={`status-pill ${selectedConfig.bg} ${selectedConfig.color}`}
                            >
                              {selectedStatus}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 xl:max-w-3xl">
                      {statusOptions.map((status) => {
                        const Icon = status.icon
                        const isActive = selectedStatus === status.value

                        return (
                          <button
                            key={status.value}
                            onClick={() =>
                              markAttendance(employee.id, status.value)
                            }
                            className={`flex items-center justify-center gap-2 border px-3 py-2 rounded-2xl text-sm font-bold transition ${
                              isActive
                                ? status.active
                                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                          >
                            <Icon size={16} />
                            {status.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default Attendance