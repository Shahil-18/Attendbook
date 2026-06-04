import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore"
import {
  CalendarCheck,
  Download,
  FileText,
  IndianRupee,
  Search,
  Users,
  Building2,
} from "lucide-react"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function Reports() {
  const { currentUser } = useAuth()

  const [companies, setCompanies] = useState([])
  const [employees, setEmployees] = useState([])
  const [manualAttendance, setManualAttendance] = useState([])
  const [payrollReports, setPayrollReports] = useState([])

  const [selectedCompany, setSelectedCompany] = useState("")
  const [selectedMonth, setSelectedMonth] = useState(
    new Date().toISOString().slice(0, 7)
  )
  const [searchText, setSearchText] = useState("")
  const [reportType, setReportType] = useState("combined")

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

  const formatDate = (dateValue) => {
    if (!dateValue) return "-"

    const date = new Date(`${dateValue}T00:00:00`)

    if (isNaN(date)) return dateValue

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const getCompanyName = (companyId) => {
    const company = companies.find((item) => item.id === companyId)
    return company?.name || company?.companyName || "-"
  }

  const getEmployeeName = (employeeId) => {
    const employee = employees.find((item) => item.id === employeeId)

    return (
      employee?.name ||
      employee?.employeeName ||
      employee?.fullName ||
      employeeId ||
      "-"
    )
  }

  const fetchReportsData = async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      setError("")

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

      const payrollReportsQuery = query(
        collection(db, "payrollReports"),
        where("caId", "==", currentUser.uid)
      )

      const [
        companiesSnapshot,
        employeesSnapshot,
        attendanceSnapshot,
        payrollReportsSnapshot,
      ] = await Promise.all([
        getDocs(companiesQuery),
        getDocs(employeesQuery),
        getDocs(attendanceQuery),
        getDocs(payrollReportsQuery),
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

      const payrollList = payrollReportsSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      payrollList.sort((a, b) => {
        return Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
      })

      setCompanies(companyList)
      setEmployees(employeeList)
      setManualAttendance(attendanceList)
      setPayrollReports(payrollList)
    } catch (err) {
      setError("Failed to load reports data.")
    } finally {
      setLoading(false)
    }
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const employeeName =
        employee.name || employee.employeeName || employee.fullName || ""

      const matchesCompany = selectedCompany
        ? employee.companyId === selectedCompany
        : true

      const matchesSearch = employeeName
        .toLowerCase()
        .includes(searchText.toLowerCase())

      return matchesCompany && matchesSearch
    })
  }, [employees, selectedCompany, searchText])

  const manualRows = useMemo(() => {
    const employeeIds = filteredEmployees.map((employee) => employee.id)

    return manualAttendance
      .filter((item) => {
        const dateValue = item.date || item.attendanceDate || ""

        const matchesCompany = selectedCompany
          ? item.companyId === selectedCompany
          : true

        const matchesMonth = selectedMonth
          ? dateValue.startsWith(selectedMonth)
          : true

        const matchesEmployee =
          employeeIds.length > 0 ? employeeIds.includes(item.employeeId) : true

        return matchesCompany && matchesMonth && matchesEmployee
      })
      .map((item) => ({
        ...item,
        employeeName:
          item.employeeName ||
          item.name ||
          getEmployeeName(item.employeeId),
        companyName: getCompanyName(item.companyId),
        dateValue: item.date || item.attendanceDate || "-",
        status: item.status || item.attendanceStatus || "-",
      }))
      .filter((item) =>
        item.employeeName.toLowerCase().includes(searchText.toLowerCase())
      )
      .sort((a, b) => {
        if (a.dateValue !== b.dateValue) {
          return a.dateValue.localeCompare(b.dateValue)
        }

        return a.employeeName.localeCompare(b.employeeName)
      })
  }, [
    manualAttendance,
    filteredEmployees,
    selectedCompany,
    selectedMonth,
    searchText,
    companies,
    employees,
  ])

  const payrollRows = useMemo(() => {
    return payrollReports
      .filter((report) => {
        const matchesMonth = selectedMonth
          ? report.selectedMonth === selectedMonth
          : true

        return matchesMonth
      })
      .flatMap((report) => {
        const attendanceRows = report.attendanceRows || []
        const salaryConfig = report.salaryConfig || {}

        return attendanceRows.map((row) => {
          const config = salaryConfig[row.employeeKey] || {}

          const monthlySalary = Number(config.monthlySalary || 0)
          const standardHours = Number(
            config.standardHours || report.defaultStandardHours || 8
          )
          const workingDays = Number(
            config.workingDays || report.defaultWorkingDays || 26
          )

          const halfDayMinimumHours = Number(report.halfDayMinimumHours || 4)
          const overtimeMultiplier = Number(report.overtimeMultiplier || 1.5)

          const overtimeEnabled =
            typeof report.overtimeEnabled === "boolean"
              ? report.overtimeEnabled
              : true

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
          let payableSalary = 0

          if (status === "Full Day" || status === "Half Day") {
            if (overtimeEnabled && row.workingHours > standardHours) {
              overtimeHours = row.workingHours - standardHours
              payableSalary =
                standardHours * perHourRate +
                overtimeHours * perHourRate * overtimeMultiplier
            } else {
              payableSalary = row.workingHours * perHourRate
            }
          }

          return {
            reportId: report.id,
            reportName: report.reportName,
            reportMonth: report.selectedMonth,
            employeeName: row.employeeName,
            employeeId: row.employeeId,
            dateValue: row.dateKey,
            displayDate: row.displayDate,
            inTime: row.inTime,
            outTime: row.outTime,
            workingHours: row.workingHours,
            overtimeHours,
            status,
            monthlySalary,
            perHourRate,
            payableSalary,
          }
        })
      })
      .filter((row) =>
        row.employeeName.toLowerCase().includes(searchText.toLowerCase())
      )
      .sort((a, b) => {
        if (a.dateValue !== b.dateValue) {
          return a.dateValue.localeCompare(b.dateValue)
        }

        return a.employeeName.localeCompare(b.employeeName)
      })
  }, [payrollReports, selectedMonth, searchText])

  const manualSummary = useMemo(() => {
    const total = manualRows.length

    const present = manualRows.filter(
      (row) => row.status?.toLowerCase() === "present"
    ).length

    const absent = manualRows.filter(
      (row) => row.status?.toLowerCase() === "absent"
    ).length

    const halfDay = manualRows.filter((row) =>
      ["half day", "halfday", "half"].includes(row.status?.toLowerCase())
    ).length

    const paidLeave = manualRows.filter((row) =>
      ["paid leave", "paidleave", "leave"].includes(row.status?.toLowerCase())
    ).length

    const late = manualRows.filter(
      (row) => row.status?.toLowerCase() === "late"
    ).length

    return {
      total,
      present,
      absent,
      halfDay,
      paidLeave,
      late,
    }
  }, [manualRows])

  const payrollSummary = useMemo(() => {
    const totalPayroll = payrollRows.reduce(
      (sum, row) => sum + Number(row.payableSalary || 0),
      0
    )

    const totalHours = payrollRows.reduce(
      (sum, row) => sum + Number(row.workingHours || 0),
      0
    )

    const overtimeHours = payrollRows.reduce(
      (sum, row) => sum + Number(row.overtimeHours || 0),
      0
    )

    const fullDays = payrollRows.filter((row) => row.status === "Full Day")
      .length

    const halfDays = payrollRows.filter((row) => row.status === "Half Day")
      .length

    const missingPunch = payrollRows.filter(
      (row) => row.status === "Missing Punch"
    ).length

    const uniqueEmployees = new Set(
      payrollRows.map((row) => row.employeeName)
    ).size

    return {
      totalPayroll,
      totalHours,
      overtimeHours,
      fullDays,
      halfDays,
      missingPunch,
      uniqueEmployees,
      totalRecords: payrollRows.length,
    }
  }, [payrollRows])

  const employeeWisePayroll = useMemo(() => {
    const grouped = {}

    payrollRows.forEach((row) => {
      if (!grouped[row.employeeName]) {
        grouped[row.employeeName] = {
          employeeName: row.employeeName,
          employeeId: row.employeeId,
          monthlySalary: row.monthlySalary,
          totalHours: 0,
          overtimeHours: 0,
          payableSalary: 0,
          fullDays: 0,
          halfDays: 0,
          absentDays: 0,
          missingPunchDays: 0,
        }
      }

      grouped[row.employeeName].totalHours += Number(row.workingHours || 0)
      grouped[row.employeeName].overtimeHours += Number(row.overtimeHours || 0)
      grouped[row.employeeName].payableSalary += Number(row.payableSalary || 0)

      if (row.status === "Full Day") grouped[row.employeeName].fullDays += 1
      if (row.status === "Half Day") grouped[row.employeeName].halfDays += 1
      if (row.status === "Absent") grouped[row.employeeName].absentDays += 1
      if (row.status === "Missing Punch")
        grouped[row.employeeName].missingPunchDays += 1
    })

    return Object.values(grouped)
      .map((employee) => ({
        ...employee,
        deduction: Math.max(
          0,
          Number(employee.monthlySalary || 0) -
            Number(employee.payableSalary || 0)
        ),
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [payrollRows])

  const exportExcel = () => {
    const workbook = XLSX.utils.book_new()

    if (reportType === "manual" || reportType === "combined") {
      const manualData = manualRows.map((row) => ({
        Company: row.companyName,
        Employee: row.employeeName,
        Date: formatDate(row.dateValue),
        Status: row.status,
      }))

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(manualData),
        "Manual Attendance"
      )
    }

    if (reportType === "payroll" || reportType === "combined") {
      const payrollData = payrollRows.map((row) => ({
        Report: row.reportName,
        Month: row.reportMonth,
        Employee: row.employeeName,
        Date: row.displayDate || formatDate(row.dateValue),
        "In Time": row.inTime,
        "Out Time": row.outTime,
        "Hours": formatHours(row.workingHours),
        "Overtime": formatHours(row.overtimeHours),
        Status: row.status,
        "Per Hour Rate": Number(row.perHourRate || 0).toFixed(2),
        "Payable Salary": Number(row.payableSalary || 0).toFixed(2),
      }))

      const employeePayrollData = employeeWisePayroll.map((employee) => ({
        Employee: employee.employeeName,
        "Monthly Salary": Number(employee.monthlySalary || 0).toFixed(2),
        "Total Hours": formatHours(employee.totalHours),
        Overtime: formatHours(employee.overtimeHours),
        "Full Days": employee.fullDays,
        "Half Days": employee.halfDays,
        Absent: employee.absentDays,
        "Missing Punch": employee.missingPunchDays,
        "Payable Salary": Number(employee.payableSalary || 0).toFixed(2),
        Deduction: Number(employee.deduction || 0).toFixed(2),
      }))

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(payrollData),
        "Payroll Daily"
      )

      XLSX.utils.book_append_sheet(
        workbook,
        XLSX.utils.json_to_sheet(employeePayrollData),
        "Payroll Summary"
      )
    }

    XLSX.writeFile(workbook, `attendbook-reports-${selectedMonth}.xlsx`)
  }

  const exportPDF = () => {
    const doc = new jsPDF("landscape", "mm", "a4")

    doc.setFontSize(18)
    doc.text("AttendBook Final Reports", 14, 15)

    doc.setFontSize(10)
    doc.text(`Month: ${selectedMonth || "All"}`, 14, 23)
    doc.text(`Report Type: ${reportType}`, 14, 29)
    doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 35)

    let startY = 43

    autoTable(doc, {
      startY,
      head: [["Metric", "Value", "Metric", "Value"]],
      body: [
        [
          "Manual Records",
          manualSummary.total,
          "Payroll Records",
          payrollSummary.totalRecords,
        ],
        [
          "Manual Present",
          manualSummary.present,
          "Payroll Employees",
          payrollSummary.uniqueEmployees,
        ],
        [
          "Manual Absent",
          manualSummary.absent,
          "Total Payroll",
          formatMoney(payrollSummary.totalPayroll),
        ],
        [
          "Manual Half Day",
          manualSummary.halfDay,
          "Payroll Hours",
          formatHours(payrollSummary.totalHours),
        ],
        [
          "Manual Paid Leave",
          manualSummary.paidLeave,
          "Overtime Hours",
          formatHours(payrollSummary.overtimeHours),
        ],
      ],
      styles: {
        fontSize: 9,
      },
      headStyles: {
        fillColor: [30, 41, 59],
      },
    })

    startY = doc.lastAutoTable.finalY + 10

    if (reportType === "manual" || reportType === "combined") {
      autoTable(doc, {
        startY,
        head: [["Company", "Employee", "Date", "Status"]],
        body: manualRows.slice(0, 40).map((row) => [
          row.companyName,
          row.employeeName,
          formatDate(row.dateValue),
          row.status,
        ]),
        styles: {
          fontSize: 8,
        },
        headStyles: {
          fillColor: [37, 99, 235],
        },
      })

      startY = doc.lastAutoTable.finalY + 10
    }

    if (reportType === "payroll" || reportType === "combined") {
      if (startY > 170) {
        doc.addPage()
        startY = 15
      }

      autoTable(doc, {
        startY,
        head: [
          [
            "Employee",
            "Monthly Salary",
            "Hours",
            "OT",
            "Full",
            "Half",
            "Absent",
            "Missing",
            "Payable",
            "Deduction",
          ],
        ],
        body: employeeWisePayroll.map((employee) => [
          employee.employeeName,
          formatMoney(employee.monthlySalary),
          formatHours(employee.totalHours),
          formatHours(employee.overtimeHours),
          employee.fullDays,
          employee.halfDays,
          employee.absentDays,
          employee.missingPunchDays,
          formatMoney(employee.payableSalary),
          formatMoney(employee.deduction),
        ]),
        styles: {
          fontSize: 8,
        },
        headStyles: {
          fillColor: [22, 101, 52],
        },
      })
    }

    doc.save(`attendbook-reports-${selectedMonth}.pdf`)
  }

  useEffect(() => {
    fetchReportsData()
  }, [currentUser])

  const summaryCards = [
    {
      title: "Manual Attendance Records",
      value: manualSummary.total,
      icon: CalendarCheck,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      title: "Employees in Payroll",
      value: payrollSummary.uniqueEmployees,
      icon: Users,
      color: "text-purple-700",
      bg: "bg-purple-50",
    },
    {
      title: "Total Payroll",
      value: formatMoney(payrollSummary.totalPayroll),
      icon: IndianRupee,
      color: "text-green-700",
      bg: "bg-green-50",
    },
    {
      title: "Payroll Hours",
      value: formatHours(payrollSummary.totalHours),
      icon: FileText,
      color: "text-orange-700",
      bg: "bg-orange-50",
    },
  ]

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-500 mt-1">
            Combined manual attendance reports, punch payroll summaries and
            professional exports.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 bg-green-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-800"
          >
            <Download size={18} />
            Excel
          </button>

          <button
            onClick={exportPDF}
            className="flex items-center gap-2 bg-red-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-red-800"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-red-100 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="combined">Combined Report</option>
              <option value="manual">Manual Attendance</option>
              <option value="payroll">Payroll Summary</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company
            </label>
            <select
              value={selectedCompany}
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Companies</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name || company.companyName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Month
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Employee
            </label>

            <div className="relative">
              <Search
                size={18}
                className="absolute left-4 top-4 text-gray-400"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search employee"
                className="w-full border border-gray-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl shadow p-8">
          <p className="text-gray-500">Loading reports...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            {summaryCards.map((card) => {
              const Icon = card.icon

              return (
                <div key={card.title} className="bg-white rounded-2xl shadow p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-500">{card.title}</p>
                      <h2 className="text-2xl font-bold text-gray-800 mt-2">
                        {card.value}
                      </h2>
                    </div>

                    <div className={`${card.bg} ${card.color} p-4 rounded-2xl`}>
                      <Icon size={28} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {(reportType === "manual" || reportType === "combined") && (
            <div className="bg-white rounded-2xl shadow p-6 mb-8">
              <div className="flex items-center gap-3 mb-5">
                <CalendarCheck className="text-blue-700" size={24} />
                <h2 className="text-xl font-bold text-gray-800">
                  Manual Attendance Summary
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-500 text-sm">Total</p>
                  <h3 className="text-2xl font-bold">{manualSummary.total}</h3>
                </div>

                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-green-700 text-sm">Present</p>
                  <h3 className="text-2xl font-bold text-green-800">
                    {manualSummary.present}
                  </h3>
                </div>

                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-red-700 text-sm">Absent</p>
                  <h3 className="text-2xl font-bold text-red-800">
                    {manualSummary.absent}
                  </h3>
                </div>

                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-yellow-700 text-sm">Half Day</p>
                  <h3 className="text-2xl font-bold text-yellow-800">
                    {manualSummary.halfDay}
                  </h3>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-blue-700 text-sm">Paid Leave</p>
                  <h3 className="text-2xl font-bold text-blue-800">
                    {manualSummary.paidLeave}
                  </h3>
                </div>

                <div className="bg-orange-50 rounded-xl p-4">
                  <p className="text-orange-700 text-sm">Late</p>
                  <h3 className="text-2xl font-bold text-orange-800">
                    {manualSummary.late}
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-4 font-semibold text-gray-700">
                        Company
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Employee
                      </th>
                      <th className="p-4 font-semibold text-gray-700">Date</th>
                      <th className="p-4 font-semibold text-gray-700">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {manualRows.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center text-gray-500">
                          No manual attendance records found.
                        </td>
                      </tr>
                    ) : (
                      manualRows.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-4 text-gray-700">
                            {row.companyName}
                          </td>
                          <td className="p-4 font-medium text-gray-800">
                            {row.employeeName}
                          </td>
                          <td className="p-4 text-gray-700">
                            {formatDate(row.dateValue)}
                          </td>
                          <td className="p-4 font-semibold text-gray-800">
                            {row.status}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(reportType === "payroll" || reportType === "combined") && (
            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center gap-3 mb-5">
                <IndianRupee className="text-green-700" size={24} />
                <h2 className="text-xl font-bold text-gray-800">
                  Payroll Summary
                </h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                <div className="bg-green-50 rounded-xl p-4">
                  <p className="text-green-700 text-sm">Payroll</p>
                  <h3 className="text-xl font-bold text-green-800">
                    {formatMoney(payrollSummary.totalPayroll)}
                  </h3>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-blue-700 text-sm">Hours</p>
                  <h3 className="text-xl font-bold text-blue-800">
                    {formatHours(payrollSummary.totalHours)}
                  </h3>
                </div>

                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-purple-700 text-sm">Overtime</p>
                  <h3 className="text-xl font-bold text-purple-800">
                    {formatHours(payrollSummary.overtimeHours)}
                  </h3>
                </div>

                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-emerald-700 text-sm">Full Days</p>
                  <h3 className="text-xl font-bold text-emerald-800">
                    {payrollSummary.fullDays}
                  </h3>
                </div>

                <div className="bg-yellow-50 rounded-xl p-4">
                  <p className="text-yellow-700 text-sm">Half Days</p>
                  <h3 className="text-xl font-bold text-yellow-800">
                    {payrollSummary.halfDays}
                  </h3>
                </div>

                <div className="bg-red-50 rounded-xl p-4">
                  <p className="text-red-700 text-sm">Missing</p>
                  <h3 className="text-xl font-bold text-red-800">
                    {payrollSummary.missingPunch}
                  </h3>
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-left">
                      <th className="p-4 font-semibold text-gray-700">
                        Employee
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Monthly Salary
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Hours
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Overtime
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Full / Half
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Absent / Missing
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Payable
                      </th>
                      <th className="p-4 font-semibold text-gray-700">
                        Deduction
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {employeeWisePayroll.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-8 text-center text-gray-500">
                          No payroll records found.
                        </td>
                      </tr>
                    ) : (
                      employeeWisePayroll.map((employee) => (
                        <tr key={employee.employeeName} className="border-b">
                          <td className="p-4 font-medium text-gray-800">
                            {employee.employeeName}
                          </td>
                          <td className="p-4">
                            {formatMoney(employee.monthlySalary)}
                          </td>
                          <td className="p-4">
                            {formatHours(employee.totalHours)}
                          </td>
                          <td className="p-4">
                            {formatHours(employee.overtimeHours)}
                          </td>
                          <td className="p-4">
                            {employee.fullDays} / {employee.halfDays}
                          </td>
                          <td className="p-4">
                            {employee.absentDays} /{" "}
                            {employee.missingPunchDays}
                          </td>
                          <td className="p-4 font-bold text-green-700">
                            {formatMoney(employee.payableSalary)}
                          </td>
                          <td className="p-4 font-bold text-red-700">
                            {formatMoney(employee.deduction)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Reports