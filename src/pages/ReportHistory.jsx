import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
} from "firebase/firestore"
import {
  CalendarDays,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  History,
  IndianRupee,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function ReportHistory() {
  const { currentUser } = useAuth()

  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [searchText, setSearchText] = useState("")
  const [monthFilter, setMonthFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`
  }

  const formatHours = (hours) => {
    if (!hours || hours <= 0) return "0h 0m"

    const totalMinutes = Math.round(Number(hours) * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60

    return `${h}h ${m}m`
  }

  const fetchReports = async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      setError("")

      const q = query(
        collection(db, "payrollReports"),
        where("caId", "==", currentUser.uid)
      )

      const querySnapshot = await getDocs(q)

      const reportList = querySnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      reportList.sort((a, b) => {
        return Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
      })

      setReports(reportList)
    } catch (err) {
      setError("Failed to fetch report history.")
    } finally {
      setLoading(false)
    }
  }

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const searchValue = searchText.toLowerCase()

      const matchesSearch =
        report.reportName?.toLowerCase().includes(searchValue) ||
        report.rawFileName?.toLowerCase().includes(searchValue)

      const matchesMonth = monthFilter
        ? report.selectedMonth === monthFilter
        : true

      return matchesSearch && matchesMonth
    })
  }, [reports, searchText, monthFilter])

  const totalPayroll = useMemo(() => {
    return filteredReports.reduce(
      (sum, report) => sum + Number(report.totalPayroll || 0),
      0
    )
  }, [filteredReports])

  const openReport = (report) => {
    setSelectedReport(report)
    setSuccess(`Opened report: ${report.reportName}`)
    setError("")
  }

  const deleteReport = async (reportId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this saved report?"
    )

    if (!confirmDelete) return

    try {
      await deleteDoc(doc(db, "payrollReports", reportId))

      setReports((prev) => prev.filter((report) => report.id !== reportId))

      if (selectedReport?.id === reportId) {
        setSelectedReport(null)
      }

      setSuccess("Report deleted successfully.")
      setError("")
    } catch (err) {
      setError("Failed to delete report.")
    }
  }

  const getPayrollRows = (report) => {
    if (!report) return []

    const attendanceRows = report.attendanceRows || []
    const salaryConfig = report.salaryConfig || {}
    const defaultWorkingDays = Number(report.defaultWorkingDays || 26)
    const defaultStandardHours = Number(report.defaultStandardHours || 8)
    const overtimeMultiplier = Number(report.overtimeMultiplier || 1.5)
    const halfDayMinimumHours = Number(report.halfDayMinimumHours || 4)

    const overtimeEnabled =
      typeof report.overtimeEnabled === "boolean"
        ? report.overtimeEnabled
        : true

    return attendanceRows.map((row) => {
      const config = salaryConfig[row.employeeKey] || {}

      const monthlySalary = Number(config.monthlySalary || 0)
      const standardHours = Number(config.standardHours || defaultStandardHours)
      const workingDays = Number(config.workingDays || defaultWorkingDays)

      const perHourRate =
        workingDays > 0 && standardHours > 0
          ? monthlySalary / workingDays / standardHours
          : 0

      let status = "Absent"

      if (row.punchCount <= 1) {
        status = "Missing Punch"
      } else if (row.workingHours >= standardHours) {
        status = "Full Day"
      } else if (row.workingHours >= halfDayMinimumHours) {
        status = "Half Day"
      }

      let overtimeHours = 0
      let dailySalary = 0

      if (status === "Full Day" || status === "Half Day") {
        if (overtimeEnabled && row.workingHours > standardHours) {
          overtimeHours = row.workingHours - standardHours
          dailySalary =
            standardHours * perHourRate +
            overtimeHours * perHourRate * overtimeMultiplier
        } else {
          dailySalary = row.workingHours * perHourRate
        }
      }

      return {
        ...row,
        monthlySalary,
        standardHours,
        workingDays,
        perHourRate,
        overtimeHours,
        dailySalary,
        status,
      }
    })
  }

  const selectedPayrollRows = useMemo(() => {
    return getPayrollRows(selectedReport)
  }, [selectedReport])

  const selectedSummary = useMemo(() => {
    const totalPayroll = selectedPayrollRows.reduce(
      (sum, row) => sum + Number(row.dailySalary || 0),
      0
    )

    const totalHours = selectedPayrollRows.reduce(
      (sum, row) => sum + Number(row.workingHours || 0),
      0
    )

    const fullDays = selectedPayrollRows.filter(
      (row) => row.status === "Full Day"
    ).length

    const halfDays = selectedPayrollRows.filter(
      (row) => row.status === "Half Day"
    ).length

    const missingPunch = selectedPayrollRows.filter(
      (row) => row.status === "Missing Punch"
    ).length

    return {
      totalPayroll,
      totalHours,
      fullDays,
      halfDays,
      missingPunch,
      totalRecords: selectedPayrollRows.length,
    }
  }, [selectedPayrollRows])

  const exportSelectedReportExcel = () => {
    if (!selectedReport || selectedPayrollRows.length === 0) return

    const exportData = selectedPayrollRows.map((row) => ({
      "Employee ID": row.employeeId,
      "Employee Name": row.employeeName,
      Date: row.displayDate,
      "In Time": row.inTime,
      "Out Time": row.outTime,
      "Hours Worked": formatHours(row.workingHours),
      "Overtime Hours": formatHours(row.overtimeHours),
      "Per Hour Rate": Number(row.perHourRate || 0).toFixed(2),
      "Daily Salary": Number(row.dailySalary || 0).toFixed(2),
      Status: row.status,
    }))

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.json_to_sheet(exportData)

    XLSX.utils.book_append_sheet(workbook, worksheet, "Saved Report")

    XLSX.writeFile(
      workbook,
      `${selectedReport.reportName || "saved-report"}.xlsx`
    )
  }

  useEffect(() => {
    fetchReports()
  }, [currentUser])

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-purple-100 px-4 py-2 rounded-full text-sm font-bold">
              <Sparkles size={16} />
              Saved Payroll Archive
            </p>

            <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">
              Report History
            </h1>

            <p className="mt-3 text-slate-300 max-w-2xl">
              View, open, export and delete saved Firebase payroll reports with
              complete attendance and salary details.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-full sm:min-w-[360px]">
            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Reports</p>
              <h2 className="text-3xl font-black mt-2">
                {filteredReports.length}
              </h2>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Payroll</p>
              <h2 className="text-2xl font-black mt-2">
                {formatMoney(totalPayroll)}
              </h2>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Search Report
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
                placeholder="Search by report name or file name"
                className="premium-input pl-11"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Filter Month
            </label>

            <input
              type="month"
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="premium-input"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={fetchReports}
              disabled={loading}
              className="w-full premium-button-dark"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center">
              <History size={24} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Saved Reports
              </h2>
              <p className="text-slate-500 text-sm">
                Firebase report archive
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">Loading reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                <FileText size={34} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mt-5">
                No reports found
              </h3>
              <p className="text-slate-500 mt-2">
                Save a payroll report from Import Punch first.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-[780px] overflow-y-auto">
              {filteredReports.map((report) => (
                <div
                  key={report.id}
                  className={`p-5 hover:bg-slate-50/80 transition ${
                    selectedReport?.id === report.id ? "bg-blue-50/70" : ""
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center shrink-0">
                      <FileSpreadsheet size={23} />
                    </div>

                    <div className="flex-1">
                      <h3 className="font-black text-slate-900">
                        {report.reportName}
                      </h3>

                      <p className="text-sm text-slate-500 mt-1">
                        Month: {report.selectedMonth || "-"}
                      </p>

                      <p className="text-sm text-green-700 font-black mt-1">
                        {formatMoney(report.totalPayroll)}
                      </p>

                      <p className="text-xs text-slate-400 mt-1">
                        {report.createdAtMillis
                          ? new Date(report.createdAtMillis).toLocaleString(
                              "en-IN"
                            )
                          : "-"}
                      </p>

                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={() => openReport(report)}
                          className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-2xl font-bold hover:bg-blue-800"
                        >
                          <FolderOpen size={16} />
                          Open
                        </button>

                        <button
                          onClick={() => deleteReport(report.id)}
                          className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-2xl font-bold hover:bg-red-100"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="xl:col-span-2 bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
          {!selectedReport ? (
            <div className="text-center py-24 px-6">
              <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-[2rem] flex items-center justify-center mx-auto">
                <FileSpreadsheet size={42} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mt-6">
                Open a saved report
              </h3>
              <p className="text-slate-500 mt-2">
                Select a report from the left to view payroll details.
              </p>
            </div>
          ) : (
            <>
              <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {selectedReport.reportName}
                  </h2>
                  <p className="text-slate-500 mt-1">
                    File: {selectedReport.rawFileName || "-"} | Month:{" "}
                    {selectedReport.selectedMonth || "-"}
                  </p>
                </div>

                <button
                  onClick={exportSelectedReportExcel}
                  className="premium-button-green"
                >
                  <Download size={18} />
                  Export Excel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 p-6">
                <div className="bg-green-50 rounded-3xl p-5">
                  <IndianRupee className="text-green-700 mb-2" size={23} />
                  <p className="text-green-700 text-sm font-bold">Payroll</p>
                  <h3 className="text-xl font-black text-green-800 mt-1">
                    {formatMoney(selectedSummary.totalPayroll)}
                  </h3>
                </div>

                <div className="bg-blue-50 rounded-3xl p-5">
                  <ClockIcon />
                  <p className="text-blue-700 text-sm font-bold">Hours</p>
                  <h3 className="text-xl font-black text-blue-800 mt-1">
                    {formatHours(selectedSummary.totalHours)}
                  </h3>
                </div>

                <div className="bg-emerald-50 rounded-3xl p-5">
                  <CalendarDays className="text-emerald-700 mb-2" size={23} />
                  <p className="text-emerald-700 text-sm font-bold">
                    Full Days
                  </p>
                  <h3 className="text-xl font-black text-emerald-800 mt-1">
                    {selectedSummary.fullDays}
                  </h3>
                </div>

                <div className="bg-yellow-50 rounded-3xl p-5">
                  <CalendarDays className="text-yellow-700 mb-2" size={23} />
                  <p className="text-yellow-700 text-sm font-bold">
                    Half Days
                  </p>
                  <h3 className="text-xl font-black text-yellow-800 mt-1">
                    {selectedSummary.halfDays}
                  </h3>
                </div>

                <div className="bg-red-50 rounded-3xl p-5">
                  <CalendarDays className="text-red-700 mb-2" size={23} />
                  <p className="text-red-700 text-sm font-bold">Missing</p>
                  <h3 className="text-xl font-black text-red-800 mt-1">
                    {selectedSummary.missingPunch}
                  </h3>
                </div>
              </div>

              <div className="px-6 pb-6">
                <div className="premium-table-wrap">
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th className="premium-th">Employee</th>
                        <th className="premium-th">Date</th>
                        <th className="premium-th">In / Out</th>
                        <th className="premium-th">Hours</th>
                        <th className="premium-th">OT</th>
                        <th className="premium-th">Rate</th>
                        <th className="premium-th">Salary</th>
                        <th className="premium-th">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedPayrollRows.map((row, index) => (
                        <tr key={index}>
                          <td className="premium-td font-bold">
                            {row.employeeName}
                          </td>
                          <td className="premium-td">{row.displayDate}</td>
                          <td className="premium-td">
                            {row.inTime} / {row.outTime}
                          </td>
                          <td className="premium-td">
                            {formatHours(row.workingHours)}
                          </td>
                          <td className="premium-td">
                            {formatHours(row.overtimeHours)}
                          </td>
                          <td className="premium-td">
                            {formatMoney(row.perHourRate)}
                          </td>
                          <td className="premium-td font-black text-green-700">
                            {formatMoney(row.dailySalary)}
                          </td>
                          <td className="premium-td font-bold">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ClockIcon() {
  return <div className="text-blue-700 mb-2 font-black text-xl">⏱</div>
}

export default ReportHistory