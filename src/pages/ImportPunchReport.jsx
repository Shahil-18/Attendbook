import { useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import {
  FileSpreadsheet,
  Search,
  Download,
  FileText,
  Save,
  Trash2,
  FolderOpen,
  UploadCloud,
  Sparkles,
  History,
} from "lucide-react"
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function ImportPunchReport() {
  const { currentUser } = useAuth()

  const SALARY_STORAGE_KEY = "attendbook_salary_config"

  const [rawFileName, setRawFileName] = useState("")
  const [attendanceRows, setAttendanceRows] = useState([])
  const [salaryConfig, setSalaryConfig] = useState({})
  const [savedReports, setSavedReports] = useState([])

  const [searchText, setSearchText] = useState("")
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [selectedMonth, setSelectedMonth] = useState("")
  const [viewMode, setViewMode] = useState("day")

  const [defaultWorkingDays, setDefaultWorkingDays] = useState(26)
  const [defaultStandardHours, setDefaultStandardHours] = useState(8)
  const [overtimeEnabled, setOvertimeEnabled] = useState(true)

  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loadingReports, setLoadingReports] = useState(false)
  const [savingReport, setSavingReport] = useState(false)

  const normalizeHeader = (value) => {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "")
  }

  const normalizeText = (value) => {
    return String(value || "").toLowerCase().trim()
  }

  const excelSerialToDate = (serial) => {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const milliseconds = Number(serial) * 24 * 60 * 60 * 1000
    return new Date(excelEpoch.getTime() + milliseconds)
  }

  const parseTimestamp = (value) => {
    if (!value) return null

    if (value instanceof Date && !isNaN(value)) {
      return value
    }

    if (typeof value === "number") {
      return excelSerialToDate(value)
    }

    const parsed = new Date(String(value).trim())

    if (!isNaN(parsed)) {
      return parsed
    }

    return null
  }

  const formatDateKey = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  const formatDisplayDate = (dateKey) => {
    const date = new Date(`${dateKey}T00:00:00`)

    return date.toLocaleDateString("en-IN", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const formatTime = (date) => {
    if (!date) return "-"

    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  }

  const formatHours = (hours) => {
    if (!hours || hours <= 0) return "0h 0m"

    const totalMinutes = Math.round(Number(hours) * 60)
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60

    return `${h}h ${m}m`
  }

  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`
  }

  const getStatus = (workingHours, punchCount, standardHours) => {
    if (punchCount <= 1) return "Missing Punch"
    if (workingHours >= standardHours) return "Full Day"
    if (workingHours >= 4) return "Half Day"
    return "Absent"
  }

  const getRowColor = (status) => {
    if (status === "Full Day") return "bg-green-50 text-green-800"
    if (status === "Half Day") return "bg-yellow-50 text-yellow-800"
    return "bg-red-50 text-red-800"
  }

  const findHeaderRowIndex = (rows) => {
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const normalizedRow = rows[i].map(normalizeHeader)

      const hasName = normalizedRow.some((cell) =>
        ["employeename", "name", "empname"].includes(cell)
      )

      const hasTimestamp = normalizedRow.some((cell) =>
        [
          "timestamp",
          "datetime",
          "punchtime",
          "punchdatetime",
          "dateandtime",
        ].includes(cell)
      )

      if (hasName && hasTimestamp) {
        return i
      }
    }

    return 0
  }

  const getColumnIndex = (headers, aliases) => {
    const normalizedHeaders = headers.map(normalizeHeader)

    for (const alias of aliases) {
      const index = normalizedHeaders.indexOf(normalizeHeader(alias))

      if (index !== -1) {
        return index
      }
    }

    return -1
  }

  const getWeekStartKey = (dateKey) => {
    const date = new Date(`${dateKey}T00:00:00`)
    const day = date.getDay()
    const diff = day === 0 ? -6 : 1 - day

    date.setDate(date.getDate() + diff)

    return formatDateKey(date)
  }

  const getWeekEndKey = (weekStartKey) => {
    const date = new Date(`${weekStartKey}T00:00:00`)
    date.setDate(date.getDate() + 6)
    return formatDateKey(date)
  }

  const getEmployeeKey = (employeeId, employeeName) => {
    return employeeId && employeeId !== "-"
      ? `id_${employeeId}`
      : `name_${normalizeText(employeeName)}`
  }

  const loadSalaryConfigFromLocal = () => {
    const savedConfig = localStorage.getItem(SALARY_STORAGE_KEY)

    if (!savedConfig) return {}

    try {
      return JSON.parse(savedConfig)
    } catch (err) {
      return {}
    }
  }

  const saveSalaryConfigToLocal = () => {
    localStorage.setItem(SALARY_STORAGE_KEY, JSON.stringify(salaryConfig))
    setSuccess("Salary configuration saved successfully.")
    setError("")
  }

  const loadSavedReports = async () => {
    if (!currentUser) {
      setSavedReports([])
      return
    }

    try {
      setLoadingReports(true)

      const reportsQuery = query(
        collection(db, "payrollReports"),
        where("caId", "==", currentUser.uid)
      )

      const snapshot = await getDocs(reportsQuery)

      const reports = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }))

      reports.sort(
        (a, b) => Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
      )

      setSavedReports(reports)
    } catch (err) {
      console.error(err)
      setError("Failed to load saved reports from Firebase.")
    } finally {
      setLoadingReports(false)
    }
  }

  const parseSalaryConfigSheet = (workbook) => {
    const possibleSheet = workbook.SheetNames.find((name) =>
      ["salary", "salaryconfig", "employees", "employeeconfig"].includes(
        normalizeHeader(name)
      )
    )

    if (!possibleSheet) return {}

    const worksheet = workbook.Sheets[possibleSheet]

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: "",
      raw: true,
    })

    if (rows.length < 2) return {}

    const headers = rows[0]

    const employeeIdIndex = getColumnIndex(headers, [
      "Employee ID",
      "EmployeeID",
      "Emp ID",
      "User ID",
      "ID",
    ])

    const employeeNameIndex = getColumnIndex(headers, [
      "Employee Name",
      "EmployeeName",
      "Emp Name",
      "Name",
    ])

    const salaryIndex = getColumnIndex(headers, [
      "Monthly Salary",
      "Monthly CTC",
      "Gross Salary",
      "Salary",
      "CTC",
    ])

    const standardHoursIndex = getColumnIndex(headers, [
      "Standard Hours",
      "Standard Hours Per Day",
      "Hours Per Day",
    ])

    const workingDaysIndex = getColumnIndex(headers, [
      "Working Days",
      "Working Days In Month",
      "Total Working Days",
    ])

    const config = {}

    rows.slice(1).forEach((row) => {
      const employeeId =
        employeeIdIndex >= 0 ? String(row[employeeIdIndex] || "").trim() : ""

      const employeeName =
        employeeNameIndex >= 0
          ? String(row[employeeNameIndex] || "").trim()
          : ""

      const monthlySalary =
        salaryIndex >= 0 ? Number(row[salaryIndex] || 0) : 0

      const standardHours =
        standardHoursIndex >= 0
          ? Number(row[standardHoursIndex] || defaultStandardHours)
          : defaultStandardHours

      const workingDays =
        workingDaysIndex >= 0
          ? Number(row[workingDaysIndex] || defaultWorkingDays)
          : defaultWorkingDays

      if (!employeeName && !employeeId) return

      const key = getEmployeeKey(employeeId, employeeName)

      config[key] = {
        employeeId: employeeId || "-",
        employeeName,
        monthlySalary,
        standardHours,
        workingDays,
      }
    })

    return config
  }

  const handleFileUpload = (e) => {
    setError("")
    setSuccess("")
    setAttendanceRows([])
    setSalaryConfig({})
    setSearchText("")
    setFromDate("")
    setToDate("")
    setSelectedMonth("")

    const file = e.target.files[0]

    if (!file) return

    setRawFileName(file.name)

    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result)

        const workbook = XLSX.read(data, {
          type: "array",
          cellDates: true,
        })

        const importedSalaryConfig = parseSalaryConfigSheet(workbook)
        const savedLocalConfig = loadSalaryConfigFromLocal()

        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]

        const rows = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          raw: true,
        })

        if (rows.length === 0) {
          setError("Excel file is empty.")
          return
        }

        const headerRowIndex = findHeaderRowIndex(rows)
        const headers = rows[headerRowIndex]
        const dataRows = rows.slice(headerRowIndex + 1)

        let employeeIdIndex = getColumnIndex(headers, [
          "Employee ID",
          "EmployeeID",
          "Emp ID",
          "User ID",
          "ID",
        ])

        let employeeNameIndex = getColumnIndex(headers, [
          "Employee Name",
          "EmployeeName",
          "Emp Name",
          "Name",
        ])

        let timestampIndex = getColumnIndex(headers, [
          "Timestamp",
          "Date Time",
          "DateTime",
          "Punch Time",
          "Punch DateTime",
          "Date and Time",
        ])

        if (employeeNameIndex === -1 && timestampIndex === -1) {
          employeeIdIndex = 0
          employeeNameIndex = 1
          timestampIndex = 2
        }

        const firstFallbackCount = dataRows.filter(
          (row) => row[employeeNameIndex] && row[timestampIndex]
        ).length

        if (firstFallbackCount === 0) {
          employeeIdIndex = -1
          employeeNameIndex = 3
          timestampIndex = 9
        }

        const punchLogs = dataRows
          .map((row) => {
            const employeeId =
              employeeIdIndex >= 0
                ? String(row[employeeIdIndex] || "").trim()
                : ""

            const employeeName = String(row[employeeNameIndex] || "").trim()
            const timestamp = parseTimestamp(row[timestampIndex])

            if (!employeeName || !timestamp) return null

            return {
              employeeId: employeeId || "-",
              employeeName,
              timestamp,
              dateKey: formatDateKey(timestamp),
            }
          })
          .filter(Boolean)

        if (punchLogs.length === 0) {
          setError(
            "No valid punch records found. Required data: Employee Name and Timestamp."
          )
          return
        }

        const grouped = {}

        punchLogs.forEach((log) => {
          const employeeKey = getEmployeeKey(log.employeeId, log.employeeName)
          const groupKey = `${employeeKey}_${log.dateKey}`

          if (!grouped[groupKey]) {
            grouped[groupKey] = {
              employeeId: log.employeeId,
              employeeName: log.employeeName,
              employeeKey,
              dateKey: log.dateKey,
              punches: [],
            }
          }

          grouped[groupKey].punches.push(log.timestamp)
        })

        const cleanRows = Object.values(grouped).map((group) => {
          const sortedPunches = group.punches.sort((a, b) => a - b)

          const dedupedPunches = []

          sortedPunches.forEach((punch) => {
            const lastPunch = dedupedPunches[dedupedPunches.length - 1]

            if (!lastPunch) {
              dedupedPunches.push(punch)
              return
            }

            const diffMinutes = (punch - lastPunch) / (1000 * 60)

            if (diffMinutes > 2) {
              dedupedPunches.push(punch)
            }
          })

          const firstPunch = dedupedPunches[0]
          const lastPunch = dedupedPunches[dedupedPunches.length - 1]
          const punchCount = dedupedPunches.length

          const workingHours =
            punchCount > 1 ? (lastPunch - firstPunch) / (1000 * 60 * 60) : 0

          return {
            employeeId: group.employeeId,
            employeeName: group.employeeName,
            employeeKey: group.employeeKey,
            dateKey: group.dateKey,
            displayDate: formatDisplayDate(group.dateKey),
            inTime: punchCount > 0 ? formatTime(firstPunch) : "-",
            outTime: punchCount > 1 ? formatTime(lastPunch) : "-",
            workingHours,
            punchCount,
          }
        })

        cleanRows.sort((a, b) => {
          if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey)
          return a.employeeName.localeCompare(b.employeeName)
        })

        const initialConfig = {
          ...importedSalaryConfig,
          ...savedLocalConfig,
        }

        cleanRows.forEach((row) => {
          if (!initialConfig[row.employeeKey]) {
            initialConfig[row.employeeKey] = {
              employeeId: row.employeeId,
              employeeName: row.employeeName,
              monthlySalary: 0,
              standardHours: defaultStandardHours,
              workingDays: defaultWorkingDays,
            }
          }
        })

        setSalaryConfig(initialConfig)
        setAttendanceRows(cleanRows)

        if (cleanRows.length > 0) {
          setSelectedMonth(cleanRows[0].dateKey.slice(0, 7))
        }

        setSuccess("Excel processed successfully.")
      } catch (err) {
        console.error(err)
        setError("Failed to process Excel file. Please check the file format.")
      }
    }

    reader.readAsArrayBuffer(file)
  }

  const updateSalaryConfig = (employeeKey, field, value) => {
    setSalaryConfig((prev) => ({
      ...prev,
      [employeeKey]: {
        ...prev[employeeKey],
        [field]: field === "employeeName" ? value : Number(value),
      },
    }))
  }

  const payrollRows = useMemo(() => {
    return attendanceRows.map((row) => {
      const config = salaryConfig[row.employeeKey] || {}

      const monthlySalary = Number(config.monthlySalary || 0)
      const standardHours = Number(config.standardHours || defaultStandardHours)
      const workingDays = Number(config.workingDays || defaultWorkingDays)

      const perHourRate =
        workingDays > 0 && standardHours > 0
          ? monthlySalary / workingDays / standardHours
          : 0

      const status = getStatus(row.workingHours, row.punchCount, standardHours)

      let regularHours = 0
      let overtimeHours = 0
      let dailySalary = 0

      if (status === "Full Day" || status === "Half Day") {
        if (overtimeEnabled && row.workingHours > standardHours) {
          regularHours = standardHours
          overtimeHours = row.workingHours - standardHours
          dailySalary =
            regularHours * perHourRate + overtimeHours * perHourRate * 1.5
        } else {
          regularHours = row.workingHours
          overtimeHours = 0
          dailySalary = row.workingHours * perHourRate
        }
      }

      return {
        ...row,
        monthlySalary,
        standardHours,
        workingDays,
        perHourRate,
        regularHours,
        overtimeHours,
        dailySalary,
        status,
        workingHoursText: formatHours(row.workingHours),
        overtimeText: formatHours(overtimeHours),
      }
    })
  }, [
    attendanceRows,
    salaryConfig,
    defaultStandardHours,
    defaultWorkingDays,
    overtimeEnabled,
  ])

  const filteredRows = useMemo(() => {
    return payrollRows.filter((row) => {
      const matchesSearch = row.employeeName
        .toLowerCase()
        .includes(searchText.toLowerCase())

      const matchesFromDate = fromDate ? row.dateKey >= fromDate : true
      const matchesToDate = toDate ? row.dateKey <= toDate : true
      const matchesMonth = selectedMonth
        ? row.dateKey.startsWith(selectedMonth)
        : true

      return matchesSearch && matchesFromDate && matchesToDate && matchesMonth
    })
  }, [payrollRows, searchText, fromDate, toDate, selectedMonth])

  const groupedDayRows = useMemo(() => {
    const grouped = {}

    filteredRows.forEach((row) => {
      if (!grouped[row.dateKey]) {
        grouped[row.dateKey] = {
          displayDate: row.displayDate,
          rows: [],
        }
      }

      grouped[row.dateKey].rows.push(row)
    })

    return grouped
  }, [filteredRows])

  const weeklyRows = useMemo(() => {
    const grouped = {}

    filteredRows.forEach((row) => {
      const weekStart = getWeekStartKey(row.dateKey)
      const weekEnd = getWeekEndKey(weekStart)
      const key = `${row.employeeKey}_${weekStart}`

      if (!grouped[key]) {
        grouped[key] = {
          employeeName: row.employeeName,
          weekStart,
          weekEnd,
          totalHours: 0,
          overtimeHours: 0,
          weeklySalary: 0,
          presentDays: 0,
          halfDays: 0,
          absentDays: 0,
          missingPunchDays: 0,
        }
      }

      grouped[key].totalHours += Number(row.workingHours || 0)
      grouped[key].overtimeHours += Number(row.overtimeHours || 0)
      grouped[key].weeklySalary += Number(row.dailySalary || 0)

      if (row.status === "Full Day") grouped[key].presentDays += 1
      if (row.status === "Half Day") grouped[key].halfDays += 1
      if (row.status === "Absent") grouped[key].absentDays += 1
      if (row.status === "Missing Punch") grouped[key].missingPunchDays += 1
    })

    return Object.values(grouped).sort((a, b) => {
      if (a.weekStart !== b.weekStart) {
        return a.weekStart.localeCompare(b.weekStart)
      }

      return a.employeeName.localeCompare(b.employeeName)
    })
  }, [filteredRows])

  const monthlyRows = useMemo(() => {
    const grouped = {}

    filteredRows.forEach((row) => {
      const monthKey = row.dateKey.slice(0, 7)
      const key = `${row.employeeKey}_${monthKey}`

      if (!grouped[key]) {
        grouped[key] = {
          employeeName: row.employeeName,
          monthKey,
          monthlySalary: row.monthlySalary,
          totalHours: 0,
          overtimeHours: 0,
          salaryEarned: 0,
          fullDays: 0,
          halfDays: 0,
          absentDays: 0,
          missingPunchDays: 0,
        }
      }

      grouped[key].totalHours += Number(row.workingHours || 0)
      grouped[key].overtimeHours += Number(row.overtimeHours || 0)
      grouped[key].salaryEarned += Number(row.dailySalary || 0)

      if (row.status === "Full Day") grouped[key].fullDays += 1
      if (row.status === "Half Day") grouped[key].halfDays += 1
      if (row.status === "Absent") grouped[key].absentDays += 1
      if (row.status === "Missing Punch") grouped[key].missingPunchDays += 1
    })

    return Object.values(grouped)
      .map((row) => ({
        ...row,
        deduction: Math.max(0, row.monthlySalary - row.salaryEarned),
      }))
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  }, [filteredRows])

  const summary = useMemo(() => {
    const totalPayroll = filteredRows.reduce(
      (sum, row) => sum + Number(row.dailySalary || 0),
      0
    )

    const totalHours = filteredRows.reduce(
      (sum, row) => sum + Number(row.workingHours || 0),
      0
    )

    const avgHours =
      filteredRows.length > 0 ? totalHours / filteredRows.length : 0

    const employeeStats = {}

    filteredRows.forEach((row) => {
      if (!employeeStats[row.employeeName]) {
        employeeStats[row.employeeName] = {
          employeeName: row.employeeName,
          totalInMinutes: 0,
          validDays: 0,
        }
      }

      if (row.inTime && row.inTime !== "-") {
        const [hours, minutes] = row.inTime.split(":").map(Number)
        employeeStats[row.employeeName].totalInMinutes += hours * 60 + minutes
        employeeStats[row.employeeName].validDays += 1
      }
    })

    const punctualList = Object.values(employeeStats)
      .filter((item) => item.validDays > 0)
      .sort(
        (a, b) =>
          a.totalInMinutes / a.validDays - b.totalInMinutes / b.validDays
      )

    return {
      totalPayroll,
      avgHours,
      totalRecords: filteredRows.length,
      mostPunctual: punctualList[0]?.employeeName || "-",
    }
  }, [filteredRows])

  const saveReportHistory = async () => {
    if (!currentUser) {
      setError("Please login first to save report in Firebase.")
      return
    }

    if (attendanceRows.length === 0) {
      setError("Upload and process a report first.")
      return
    }

    const reportName =
      window.prompt(
        "Enter report name",
        `Payroll Report ${selectedMonth || new Date().toISOString().slice(0, 7)}`
      ) || ""

    if (!reportName.trim()) return

    try {
      setSavingReport(true)

      const newReport = {
        caId: currentUser.uid,
        reportName: reportName.trim(),
        rawFileName,
        selectedMonth,
        defaultWorkingDays,
        defaultStandardHours,
        overtimeEnabled,
        attendanceRows,
        salaryConfig,
        totalPayroll: summary.totalPayroll,
        totalRecords: summary.totalRecords,
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now(),
      }

      await addDoc(collection(db, "payrollReports"), newReport)

      await loadSavedReports()

      setSuccess("Report saved successfully in Firebase.")
      setError("")
    } catch (err) {
      console.error(err)
      setError("Failed to save report in Firebase.")
    } finally {
      setSavingReport(false)
    }
  }

  const openSavedReport = (report) => {
    setRawFileName(report.rawFileName || "")
    setSelectedMonth(report.selectedMonth || "")
    setDefaultWorkingDays(report.defaultWorkingDays || 26)
    setDefaultStandardHours(report.defaultStandardHours || 8)
    setOvertimeEnabled(
      typeof report.overtimeEnabled === "boolean"
        ? report.overtimeEnabled
        : true
    )
    setAttendanceRows(report.attendanceRows || [])
    setSalaryConfig(report.salaryConfig || {})
    setSearchText("")
    setFromDate("")
    setToDate("")
    setViewMode("day")
    setSuccess(`Opened saved report: ${report.reportName}`)
    setError("")
  }

  const deleteSavedReport = async (reportId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this saved report?"
    )

    if (!confirmDelete) return

    try {
      await deleteDoc(doc(db, "payrollReports", reportId))

      setSavedReports((prev) =>
        prev.filter((report) => report.id !== reportId)
      )

      setSuccess("Saved report deleted from Firebase.")
      setError("")
    } catch (err) {
      console.error(err)
      setError("Failed to delete report from Firebase.")
    }
  }

  const exportToExcel = () => {
    if (filteredRows.length === 0) return

    const exportData = filteredRows.map((row) => ({
      "Employee ID": row.employeeId,
      "Employee Name": row.employeeName,
      Date: row.displayDate,
      "In Time": row.inTime,
      "Out Time": row.outTime,
      "Hours Worked": row.workingHoursText,
      "Per Hour Rate": Number(row.perHourRate || 0).toFixed(2),
      "Overtime Hours": row.overtimeText,
      "Daily Salary": Number(row.dailySalary || 0).toFixed(2),
      Status: row.status,
    }))

    const weeklyData = weeklyRows.map((row) => ({
      Employee: row.employeeName,
      Week: `${formatDisplayDate(row.weekStart)} - ${formatDisplayDate(row.weekEnd)}`,
      "Total Hours": formatHours(row.totalHours),
      Overtime: formatHours(row.overtimeHours),
      "Full Days": row.presentDays,
      "Half Days": row.halfDays,
      Absent: row.absentDays,
      "Missing Punch": row.missingPunchDays,
      "Weekly Salary": Number(row.weeklySalary || 0).toFixed(2),
    }))

    const monthlyData = monthlyRows.map((row) => ({
      Employee: row.employeeName,
      Month: row.monthKey,
      "Monthly Salary": Number(row.monthlySalary || 0).toFixed(2),
      "Total Hours": formatHours(row.totalHours),
      Overtime: formatHours(row.overtimeHours),
      "Full Days": row.fullDays,
      "Half Days": row.halfDays,
      Absent: row.absentDays,
      "Missing Punch": row.missingPunchDays,
      "Salary Earned": Number(row.salaryEarned || 0).toFixed(2),
      Deduction: Number(row.deduction || 0).toFixed(2),
    }))

    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(exportData),
      "Day Report"
    )

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(weeklyData),
      "Week Report"
    )

    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(monthlyData),
      "Month Report"
    )

    XLSX.writeFile(workbook, "payroll-attendance-report.xlsx")
  }

  const exportToPDF = () => {
    if (filteredRows.length === 0) return

    const docPdf = new jsPDF("landscape")

    docPdf.setFontSize(16)
    docPdf.text("Payroll Attendance Report", 14, 15)

    docPdf.setFontSize(10)
    docPdf.text(`Source File: ${rawFileName || "-"}`, 14, 22)
    docPdf.text(`Total Payroll: ${formatMoney(summary.totalPayroll)}`, 14, 28)

    autoTable(docPdf, {
      startY: 34,
      head: [
        [
          "Employee",
          "Date",
          "In",
          "Out",
          "Hours",
          "OT",
          "Rate",
          "Daily Salary",
          "Status",
        ],
      ],
      body: filteredRows.map((row) => [
        row.employeeName,
        row.displayDate,
        row.inTime,
        row.outTime,
        row.workingHoursText,
        row.overtimeText,
        formatMoney(row.perHourRate),
        formatMoney(row.dailySalary),
        row.status,
      ]),
      styles: {
        fontSize: 8,
      },
      headStyles: {
        fillColor: [30, 41, 59],
      },
    })

    docPdf.save("payroll-attendance-report.pdf")
  }

  const downloadSampleTemplate = () => {
    const punchData = [
      {
        "Employee ID": 101,
        "Employee Name": "Rahul Sharma",
        Timestamp: "2026-06-02 09:02:33",
      },
      {
        "Employee ID": 101,
        "Employee Name": "Rahul Sharma",
        Timestamp: "2026-06-02 18:05:10",
      },
      {
        "Employee ID": 102,
        "Employee Name": "Amit Kumar",
        Timestamp: "2026-06-02 09:30:00",
      },
      {
        "Employee ID": 102,
        "Employee Name": "Amit Kumar",
        Timestamp: "2026-06-02 14:00:00",
      },
    ]

    const salaryData = [
      {
        "Employee ID": 101,
        "Employee Name": "Rahul Sharma",
        "Monthly Salary": 30000,
        "Working Days": 26,
        "Standard Hours": 8,
      },
      {
        "Employee ID": 102,
        "Employee Name": "Amit Kumar",
        "Monthly Salary": 18000,
        "Working Days": 26,
        "Standard Hours": 8,
      },
    ]

    const punchSheet = XLSX.utils.json_to_sheet(punchData)
    const salarySheet = XLSX.utils.json_to_sheet(salaryData)

    const workbook = XLSX.utils.book_new()

    XLSX.utils.book_append_sheet(workbook, punchSheet, "PunchData")
    XLSX.utils.book_append_sheet(workbook, salarySheet, "Salary")

    XLSX.writeFile(workbook, "sample-punch-payroll-template.xlsx")
  }

  useEffect(() => {
    if (currentUser) {
      loadSavedReports()
    }
  }, [currentUser])

  return (
    <div>
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl mb-8">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10">
          <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-blue-100 px-4 py-2 rounded-full text-sm font-bold">
            <Sparkles size={16} />
            AttendBook Payroll Engine
          </p>

          <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            Import Punch Report
          </h1>

          <p className="mt-4 text-slate-300 max-w-3xl leading-relaxed">
            Upload biometric punch Excel, clean attendance, calculate salary,
            generate Day / Week / Month reports and save report history in
            Firebase.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 bg-red-100 text-red-700 px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-5 bg-green-100 text-green-700 px-4 py-3 rounded-xl">
          {success}
        </div>
      )}

      <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6 mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center">
            <UploadCloud size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Upload Punch Excel File
            </h2>
            <p className="text-slate-500 text-sm">
              Your working parser is kept same. Firebase report saving is added.
            </p>
          </div>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="w-full border-2 border-dashed border-slate-200 rounded-2xl px-5 py-5 bg-slate-50 hover:bg-blue-50/50 outline-none transition"
        />

        <div className="flex flex-wrap gap-3 mt-4">
          <button
            onClick={downloadSampleTemplate}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-semibold hover:bg-slate-800"
          >
            <Download size={18} />
            Download Sample Template
          </button>

          <button
            onClick={saveReportHistory}
            disabled={attendanceRows.length === 0 || savingReport}
            className="flex items-center gap-2 bg-purple-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-purple-800 disabled:bg-purple-300"
          >
            <Save size={18} />
            {savingReport ? "Saving..." : "Save Report"}
          </button>
        </div>

        <div className="mt-5 bg-blue-50 text-blue-700 p-4 rounded-xl text-sm">
          Supported punch format: Employee ID, Employee Name, Timestamp. It also
          supports your earlier biometric format where Column D is Employee Name
          and Column J is Timestamp. Optional salary sheet name can be Salary,
          SalaryConfig, Employees, or EmployeeConfig.
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6 mb-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center">
            <History size={24} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Saved Report History
            </h2>
            <p className="text-slate-500 text-sm">
              Reports are now saved in Firebase.
            </p>
          </div>
        </div>

        {loadingReports ? (
          <p className="text-gray-500">Loading saved reports...</p>
        ) : savedReports.length === 0 ? (
          <p className="text-gray-500">No saved reports yet.</p>
        ) : (
          <div className="space-y-4">
            {savedReports.map((report) => (
              <div
                key={report.id}
                className="border border-gray-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white"
              >
                <div>
                  <h3 className="font-bold text-gray-800">
                    {report.reportName}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Month: {report.selectedMonth || "-"} | Records:{" "}
                    {report.totalRecords || 0} | Payroll:{" "}
                    {formatMoney(report.totalPayroll)}
                  </p>
                  <p className="text-sm text-gray-500">
                    File: {report.rawFileName || "-"} | Saved:{" "}
                    {report.createdAtMillis
                      ? new Date(report.createdAtMillis).toLocaleString("en-IN")
                      : "-"}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => openSavedReport(report)}
                    className="flex items-center gap-2 bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold hover:bg-blue-800"
                  >
                    <FolderOpen size={17} />
                    Open
                  </button>

                  <button
                    onClick={() => deleteSavedReport(report.id)}
                    className="flex items-center gap-2 bg-red-700 text-white px-4 py-2 rounded-xl font-semibold hover:bg-red-800"
                  >
                    <Trash2 size={17} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {attendanceRows.length > 0 && (
        <>
          <div className="bg-white rounded-2xl shadow p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-5">
              Payroll Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Working Days in Month
                </label>
                <input
                  type="number"
                  value={defaultWorkingDays}
                  onChange={(e) => setDefaultWorkingDays(Number(e.target.value))}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Default Standard Hours/Day
                </label>
                <input
                  type="number"
                  value={defaultStandardHours}
                  onChange={(e) =>
                    setDefaultStandardHours(Number(e.target.value))
                  }
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-end">
                <label className="flex items-center gap-3 bg-gray-100 px-4 py-3 rounded-xl w-full">
                  <input
                    type="checkbox"
                    checked={overtimeEnabled}
                    onChange={(e) => setOvertimeEnabled(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="font-medium text-gray-700">
                    Overtime 1.5x Enabled
                  </span>
                </label>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-bold text-gray-800">
                Employee Salary Configuration
              </h2>

              <button
                onClick={saveSalaryConfigToLocal}
                className="flex items-center gap-2 bg-blue-700 text-white px-5 py-3 rounded-xl font-semibold hover:bg-blue-800"
              >
                <Save size={18} />
                Save Salary Config
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="p-4 font-semibold text-gray-700">
                      Employee
                    </th>
                    <th className="p-4 font-semibold text-gray-700">
                      Monthly CTC / Gross Salary
                    </th>
                    <th className="p-4 font-semibold text-gray-700">
                      Working Days
                    </th>
                    <th className="p-4 font-semibold text-gray-700">
                      Standard Hours
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {Object.entries(salaryConfig).map(([employeeKey, config]) => (
                    <tr key={employeeKey} className="border-b">
                      <td className="p-4 font-medium text-gray-800">
                        {config.employeeName}
                      </td>

                      <td className="p-4">
                        <input
                          type="number"
                          value={config.monthlySalary}
                          onChange={(e) =>
                            updateSalaryConfig(
                              employeeKey,
                              "monthlySalary",
                              e.target.value
                            )
                          }
                          className="w-44 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          type="number"
                          value={config.workingDays}
                          onChange={(e) =>
                            updateSalaryConfig(
                              employeeKey,
                              "workingDays",
                              e.target.value
                            )
                          }
                          className="w-32 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </td>

                      <td className="p-4">
                        <input
                          type="number"
                          value={config.standardHours}
                          onChange={(e) =>
                            updateSalaryConfig(
                              employeeKey,
                              "standardHours",
                              e.target.value
                            )
                          }
                          className="w-32 border border-gray-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500">Total Payroll</p>
              <h2 className="text-3xl font-bold text-green-700 mt-2">
                {formatMoney(summary.totalPayroll)}
              </h2>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500">Avg Hours/Day</p>
              <h2 className="text-3xl font-bold text-blue-700 mt-2">
                {formatHours(summary.avgHours)}
              </h2>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500">Most Punctual</p>
              <h2 className="text-xl font-bold text-gray-800 mt-2">
                {summary.mostPunctual}
              </h2>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <p className="text-gray-500">Total Records</p>
              <h2 className="text-3xl font-bold text-gray-800 mt-2">
                {summary.totalRecords}
              </h2>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  View
                </label>
                <select
                  value={viewMode}
                  onChange={(e) => setViewMode(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="day">Day View</option>
                  <option value="week">Week View</option>
                  <option value="month">Month View</option>
                </select>
              </div>

              <div className="md:col-span-2">
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
                    placeholder="Search by employee name"
                    className="w-full border border-gray-300 rounded-xl pl-11 pr-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
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

              <div className="flex items-end gap-3">
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 bg-green-700 text-white px-4 py-3 rounded-xl font-semibold hover:bg-green-800"
                >
                  <Download size={18} />
                  Excel
                </button>

                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 bg-red-700 text-white px-4 py-3 rounded-xl font-semibold hover:bg-red-800"
                >
                  <FileText size={18} />
                  PDF
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Date
                </label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  To Date
                </label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-2xl shadow p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-5">
          Payroll Attendance Report
        </h2>

        {filteredRows.length === 0 ? (
          <div className="text-center py-12">
            <FileSpreadsheet className="mx-auto text-gray-400" size={48} />
            <p className="text-gray-500 mt-3">
              Upload an Excel file or open a saved report.
            </p>
          </div>
        ) : viewMode === "day" ? (
          <div className="space-y-8">
            {Object.entries(groupedDayRows).map(([dateKey, group]) => (
              <div key={dateKey}>
                <h3 className="text-lg font-bold text-gray-800 mb-3">
                  {group.displayDate}
                </h3>

                <div className="overflow-x-auto border border-gray-200 rounded-2xl">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-left">
                        <th className="p-4 font-semibold text-gray-700">
                          Employee
                        </th>
                        <th className="p-4 font-semibold text-gray-700">
                          In / Out
                        </th>
                        <th className="p-4 font-semibold text-gray-700">
                          Hours
                        </th>
                        <th className="p-4 font-semibold text-gray-700">
                          Overtime
                        </th>
                        <th className="p-4 font-semibold text-gray-700">
                          Rate / Hour
                        </th>
                        <th className="p-4 font-semibold text-gray-700">
                          Daily Salary
                        </th>
                        <th className="p-4 font-semibold text-gray-700">
                          Status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {group.rows.map((row, index) => (
                        <tr
                          key={`${row.employeeName}-${row.dateKey}-${index}`}
                          className={`border-b ${getRowColor(row.status)}`}
                        >
                          <td className="p-4 font-medium">
                            {row.employeeName}
                          </td>
                          <td className="p-4">
                            {row.inTime} / {row.outTime}
                          </td>
                          <td className="p-4">{row.workingHoursText}</td>
                          <td className="p-4">{row.overtimeText}</td>
                          <td className="p-4">
                            {formatMoney(row.perHourRate)}
                          </td>
                          <td className="p-4 font-bold">
                            {formatMoney(row.dailySalary)}
                          </td>
                          <td className="p-4 font-bold">{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        ) : viewMode === "week" ? (
          <div className="overflow-x-auto border border-gray-200 rounded-2xl">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-4 font-semibold text-gray-700">Employee</th>
                  <th className="p-4 font-semibold text-gray-700">Week</th>
                  <th className="p-4 font-semibold text-gray-700">
                    Total Hours
                  </th>
                  <th className="p-4 font-semibold text-gray-700">Overtime</th>
                  <th className="p-4 font-semibold text-gray-700">
                    Full Days
                  </th>
                  <th className="p-4 font-semibold text-gray-700">
                    Half Days
                  </th>
                  <th className="p-4 font-semibold text-gray-700">Absent</th>
                  <th className="p-4 font-semibold text-gray-700">
                    Missing Punch
                  </th>
                  <th className="p-4 font-semibold text-gray-700">
                    Weekly Salary
                  </th>
                </tr>
              </thead>

              <tbody>
                {weeklyRows.map((row, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-4 font-medium text-gray-800">
                      {row.employeeName}
                    </td>
                    <td className="p-4 text-gray-600">
                      {formatDisplayDate(row.weekStart)} -{" "}
                      {formatDisplayDate(row.weekEnd)}
                    </td>
                    <td className="p-4">{formatHours(row.totalHours)}</td>
                    <td className="p-4">{formatHours(row.overtimeHours)}</td>
                    <td className="p-4 text-green-700 font-semibold">
                      {row.presentDays}
                    </td>
                    <td className="p-4 text-yellow-700 font-semibold">
                      {row.halfDays}
                    </td>
                    <td className="p-4 text-red-700 font-semibold">
                      {row.absentDays}
                    </td>
                    <td className="p-4 text-red-700 font-semibold">
                      {row.missingPunchDays}
                    </td>
                    <td className="p-4 font-bold text-green-700">
                      {formatMoney(row.weeklySalary)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-2xl">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-4 font-semibold text-gray-700">Employee</th>
                  <th className="p-4 font-semibold text-gray-700">Month</th>
                  <th className="p-4 font-semibold text-gray-700">
                    Monthly Salary
                  </th>
                  <th className="p-4 font-semibold text-gray-700">
                    Total Hours
                  </th>
                  <th className="p-4 font-semibold text-gray-700">Overtime</th>
                  <th className="p-4 font-semibold text-gray-700">
                    Full Days
                  </th>
                  <th className="p-4 font-semibold text-gray-700">
                    Half Days
                  </th>
                  <th className="p-4 font-semibold text-gray-700">Absent</th>
                  <th className="p-4 font-semibold text-gray-700">
                    Missing Punch
                  </th>
                  <th className="p-4 font-semibold text-gray-700">
                    Salary Earned
                  </th>
                  <th className="p-4 font-semibold text-gray-700">
                    Deduction
                  </th>
                </tr>
              </thead>

              <tbody>
                {monthlyRows.map((row, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-4 font-medium text-gray-800">
                      {row.employeeName}
                    </td>
                    <td className="p-4 text-gray-600">{row.monthKey}</td>
                    <td className="p-4">{formatMoney(row.monthlySalary)}</td>
                    <td className="p-4">{formatHours(row.totalHours)}</td>
                    <td className="p-4">{formatHours(row.overtimeHours)}</td>
                    <td className="p-4 text-green-700 font-semibold">
                      {row.fullDays}
                    </td>
                    <td className="p-4 text-yellow-700 font-semibold">
                      {row.halfDays}
                    </td>
                    <td className="p-4 text-red-700 font-semibold">
                      {row.absentDays}
                    </td>
                    <td className="p-4 text-red-700 font-semibold">
                      {row.missingPunchDays}
                    </td>
                    <td className="p-4 font-bold text-green-700">
                      {formatMoney(row.salaryEarned)}
                    </td>
                    <td className="p-4 font-bold text-red-700">
                      {formatMoney(row.deduction)}
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

export default ImportPunchReport