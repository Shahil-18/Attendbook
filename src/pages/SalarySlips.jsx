import { useEffect, useMemo, useState } from "react"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore"
import {
  Download,
  FileText,
  ReceiptText,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function SalarySlips() {
  const { currentUser } = useAuth()

  const [reports, setReports] = useState([])
  const [selectedReportId, setSelectedReportId] = useState("")
  const [searchText, setSearchText] = useState("")
  const [settings, setSettings] = useState({
    firmName: "AttendBook",
    firmOwnerName: "",
    contactNumber: "",
    email: "",
    address: "",
  })

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

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

  const loadSettings = async () => {
    if (!currentUser) return

    try {
      const settingsRef = doc(db, "userSettings", currentUser.uid)
      const settingsSnap = await getDoc(settingsRef)

      if (settingsSnap.exists()) {
        const data = settingsSnap.data()

        setSettings({
          firmName: data.firmName || "AttendBook",
          firmOwnerName: data.firmOwnerName || "",
          contactNumber: data.contactNumber || "",
          email: data.email || currentUser.email || "",
          address: data.address || "",
        })
      } else {
        setSettings((prev) => ({
          ...prev,
          email: currentUser.email || "",
        }))
      }
    } catch (err) {
      setSettings((prev) => ({
        ...prev,
        email: currentUser.email || "",
      }))
    }
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

      const snapshot = await getDocs(q)

      const reportList = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      reportList.sort((a, b) => {
        return Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
      })

      setReports(reportList)

      if (reportList.length > 0) {
        setSelectedReportId(reportList[0].id)
      }
    } catch (err) {
      setError("Failed to load saved payroll reports.")
    } finally {
      setLoading(false)
    }
  }

  const selectedReport = useMemo(() => {
    return reports.find((report) => report.id === selectedReportId) || null
  }, [reports, selectedReportId])

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

  const employeeSummaryRows = useMemo(() => {
    const payrollRows = getPayrollRows(selectedReport)
    const grouped = {}

    payrollRows.forEach((row) => {
      if (!grouped[row.employeeKey]) {
        grouped[row.employeeKey] = {
          employeeKey: row.employeeKey,
          employeeId: row.employeeId,
          employeeName: row.employeeName,
          month: selectedReport?.selectedMonth || "-",
          reportName: selectedReport?.reportName || "-",
          monthlySalary: row.monthlySalary,
          workingDays: row.workingDays,
          standardHours: row.standardHours,
          totalHours: 0,
          overtimeHours: 0,
          grossPayable: 0,
          fullDays: 0,
          halfDays: 0,
          absentDays: 0,
          missingPunchDays: 0,
          totalRecords: 0,
        }
      }

      grouped[row.employeeKey].totalRecords += 1
      grouped[row.employeeKey].totalHours += Number(row.workingHours || 0)
      grouped[row.employeeKey].overtimeHours += Number(row.overtimeHours || 0)
      grouped[row.employeeKey].grossPayable += Number(row.dailySalary || 0)

      if (row.status === "Full Day") grouped[row.employeeKey].fullDays += 1
      if (row.status === "Half Day") grouped[row.employeeKey].halfDays += 1
      if (row.status === "Absent") grouped[row.employeeKey].absentDays += 1
      if (row.status === "Missing Punch")
        grouped[row.employeeKey].missingPunchDays += 1
    })

    return Object.values(grouped)
      .map((employee) => ({
        ...employee,
        deduction: Math.max(
          0,
          Number(employee.monthlySalary || 0) -
            Number(employee.grossPayable || 0)
        ),
        netPayable: Number(employee.grossPayable || 0),
      }))
      .filter((employee) =>
        employee.employeeName.toLowerCase().includes(searchText.toLowerCase())
      )
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [selectedReport, searchText])

  const addSalarySlipPage = (docFile, employee) => {
    docFile.setFillColor(30, 41, 59)
    docFile.rect(0, 0, 210, 34, "F")

    docFile.setTextColor(255, 255, 255)
    docFile.setFontSize(20)
    docFile.text(settings.firmName || "AttendBook", 105, 14, {
      align: "center",
    })

    docFile.setFontSize(10)
    docFile.text("Salary Slip / Payroll Statement", 105, 22, {
      align: "center",
    })

    docFile.setFontSize(8)
    const contactLine = [
      settings.address,
      settings.contactNumber,
      settings.email,
    ]
      .filter(Boolean)
      .join(" | ")

    docFile.text(contactLine || "Payroll Management System", 105, 29, {
      align: "center",
    })

    docFile.setTextColor(0, 0, 0)

    autoTable(docFile, {
      startY: 46,
      theme: "grid",
      head: [["Field", "Details", "Field", "Details"]],
      body: [
        [
          "Employee Name",
          employee.employeeName,
          "Employee ID",
          employee.employeeId || "-",
        ],
        ["Month", employee.month, "Report", employee.reportName],
        [
          "Generated On",
          new Date().toLocaleDateString("en-IN"),
          "Prepared By",
          settings.firmOwnerName || settings.firmName || "-",
        ],
      ],
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [51, 65, 85],
      },
    })

    autoTable(docFile, {
      startY: docFile.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Attendance Summary", "Value"]],
      body: [
        ["Working Days", employee.workingDays],
        ["Standard Hours / Day", `${employee.standardHours} hrs`],
        ["Full Days", employee.fullDays],
        ["Half Days", employee.halfDays],
        ["Absent Days", employee.absentDays],
        ["Missing Punch Days", employee.missingPunchDays],
        ["Total Working Hours", formatHours(employee.totalHours)],
        ["Overtime Hours", formatHours(employee.overtimeHours)],
      ],
      styles: {
        fontSize: 10,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [37, 99, 235],
      },
    })

    autoTable(docFile, {
      startY: docFile.lastAutoTable.finalY + 8,
      theme: "grid",
      head: [["Salary Calculation", "Amount"]],
      body: [
        ["Gross Monthly Salary", formatMoney(employee.monthlySalary)],
        ["Salary Earned", formatMoney(employee.grossPayable)],
        ["Deduction", formatMoney(employee.deduction)],
        ["Net Payable Salary", formatMoney(employee.netPayable)],
      ],
      styles: {
        fontSize: 11,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [22, 101, 52],
      },
    })

    const finalY = docFile.lastAutoTable.finalY + 16

    docFile.setFontSize(9)
    docFile.text("Note: This is a system-generated salary slip.", 14, finalY)

    docFile.text("Authorized Signatory", 150, finalY + 24)
    docFile.line(145, finalY + 18, 195, finalY + 18)

    docFile.setFontSize(8)
    docFile.setTextColor(120, 120, 120)
    docFile.text("Generated by AttendBook", 105, 288, {
      align: "center",
    })

    docFile.setTextColor(0, 0, 0)
  }

  const downloadSingleSlip = (employee) => {
    const docFile = new jsPDF("portrait", "mm", "a4")
    addSalarySlipPage(docFile, employee)
    docFile.save(`${employee.employeeName}-${employee.month}-salary-slip.pdf`)
  }

  const downloadAllSlips = () => {
    if (employeeSummaryRows.length === 0) return

    const docFile = new jsPDF("portrait", "mm", "a4")

    employeeSummaryRows.forEach((employee, index) => {
      if (index > 0) docFile.addPage()
      addSalarySlipPage(docFile, employee)
    })

    docFile.save(`${selectedReport?.selectedMonth || "salary"}-salary-slips.pdf`)
  }

  useEffect(() => {
    if (currentUser) {
      loadSettings()
      fetchReports()
    }
  }, [currentUser])

  const totalNetPayable = employeeSummaryRows.reduce(
    (sum, employee) => sum + Number(employee.netPayable || 0),
    0
  )

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-green-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-green-100 px-4 py-2 rounded-full text-sm font-bold">
              <Sparkles size={16} />
              Payroll Documents
            </p>

            <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">
              Salary Slips
            </h1>

            <p className="mt-3 text-slate-300 max-w-2xl">
              Generate premium employee-wise salary slips from saved payroll
              reports with firm details from Firebase Settings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-full sm:min-w-[360px]">
            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Employees</p>
              <h2 className="text-3xl font-black mt-2">
                {employeeSummaryRows.length}
              </h2>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Net Payable</p>
              <h2 className="text-2xl font-black mt-2">
                {formatMoney(totalNetPayable)}
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

      <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Select Saved Report
            </label>

            <select
              value={selectedReportId}
              onChange={(e) => setSelectedReportId(e.target.value)}
              className="premium-select"
            >
              <option value="">Select report</option>
              {reports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.reportName} - {report.selectedMonth || "-"}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
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

          <div className="flex items-end">
            <button
              onClick={downloadAllSlips}
              disabled={!selectedReport || employeeSummaryRows.length === 0}
              className="w-full premium-button-green"
            >
              <Download size={18} />
              All Slips
            </button>
          </div>
        </div>

        <div className="mt-5 bg-blue-50 border border-blue-100 text-blue-700 p-4 rounded-2xl text-sm">
          Slip Header: <strong>{settings.firmName || "AttendBook"}</strong>
          {settings.firmOwnerName ? ` | ${settings.firmOwnerName}` : ""}
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-12 h-12 bg-green-50 text-green-700 rounded-2xl flex items-center justify-center">
            <ReceiptText size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Employee Salary Slip List
            </h2>
            <p className="text-slate-500 text-sm">
              Download single or all employee salary slips
            </p>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-slate-500">Loading salary reports...</div>
        ) : !selectedReport ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <FileText size={34} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mt-5">
              Select a report
            </h3>
            <p className="text-slate-500 mt-2">
              Choose a saved payroll report first.
            </p>
          </div>
        ) : employeeSummaryRows.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
              <UserRound size={34} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mt-5">
              No employees found
            </h3>
            <p className="text-slate-500 mt-2">
              Try a different report or search value.
            </p>
          </div>
        ) : (
          <div className="premium-table-wrap rounded-none border-0">
            <table className="premium-table">
              <thead>
                <tr>
                  <th className="premium-th">Employee</th>
                  <th className="premium-th">Month</th>
                  <th className="premium-th">Monthly Salary</th>
                  <th className="premium-th">Full / Half</th>
                  <th className="premium-th">Absent / Missing</th>
                  <th className="premium-th">Hours</th>
                  <th className="premium-th">Net Payable</th>
                  <th className="premium-th">Action</th>
                </tr>
              </thead>

              <tbody>
                {employeeSummaryRows.map((employee) => (
                  <tr key={employee.employeeKey}>
                    <td className="premium-td font-black">
                      {employee.employeeName}
                    </td>

                    <td className="premium-td">{employee.month}</td>

                    <td className="premium-td">
                      {formatMoney(employee.monthlySalary)}
                    </td>

                    <td className="premium-td">
                      {employee.fullDays} / {employee.halfDays}
                    </td>

                    <td className="premium-td">
                      {employee.absentDays} / {employee.missingPunchDays}
                    </td>

                    <td className="premium-td">
                      {formatHours(employee.totalHours)}
                    </td>

                    <td className="premium-td font-black text-green-700">
                      {formatMoney(employee.netPayable)}
                    </td>

                    <td className="premium-td">
                      <button
                        onClick={() => downloadSingleSlip(employee)}
                        className="inline-flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-2xl font-bold hover:bg-blue-800"
                      >
                        <Download size={17} />
                        PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default SalarySlips