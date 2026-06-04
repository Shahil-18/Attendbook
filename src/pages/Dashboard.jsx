import { useEffect, useState } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  RefreshCw,
  Sparkles,
  Users,
  ReceiptText,
  History,
  TrendingUp,
} from "lucide-react"
import { Link } from "react-router-dom"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function Dashboard() {
  const { currentUser } = useAuth()

  const [stats, setStats] = useState({
    totalCompanies: 0,
    totalEmployees: 0,
    totalReports: 0,
    thisMonthPayroll: 0,
  })

  const [recentReports, setRecentReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")

  const currentMonth = new Date().toISOString().slice(0, 7)

  const formatMoney = (amount) => {
    return `₹${Number(amount || 0).toFixed(2)}`
  }

  const formatMonth = (monthValue) => {
    if (!monthValue) return "-"

    const date = new Date(`${monthValue}-01T00:00:00`)

    if (isNaN(date)) return monthValue

    return date.toLocaleDateString("en-IN", {
      month: "short",
      year: "numeric",
    })
  }

  const fetchDashboardData = async () => {
    if (!currentUser) return

    try {
      setRefreshing(true)
      setError("")

      const companiesQuery = query(
        collection(db, "companies"),
        where("caId", "==", currentUser.uid)
      )

      const employeesQuery = query(
        collection(db, "employees"),
        where("caId", "==", currentUser.uid)
      )

      const reportsQuery = query(
        collection(db, "payrollReports"),
        where("caId", "==", currentUser.uid)
      )

      const [companiesSnapshot, employeesSnapshot, reportsSnapshot] =
        await Promise.all([
          getDocs(companiesQuery),
          getDocs(employeesQuery),
          getDocs(reportsQuery),
        ])

      const reportList = reportsSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      const thisMonthPayroll = reportList
        .filter((report) => report.selectedMonth === currentMonth)
        .reduce((total, report) => total + Number(report.totalPayroll || 0), 0)

      const sortedReports = reportList.sort((a, b) => {
        return Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
      })

      setStats({
        totalCompanies: companiesSnapshot.size,
        totalEmployees: employeesSnapshot.size,
        totalReports: reportsSnapshot.size,
        thisMonthPayroll,
      })

      setRecentReports(sortedReports.slice(0, 5))
    } catch (err) {
      setError("Failed to load dashboard data.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [currentUser])

  const statCards = [
    {
      title: "Companies",
      value: stats.totalCompanies,
      subtitle: "Active client workspaces",
      icon: Building2,
      gradient: "from-blue-600 to-cyan-500",
      bg: "bg-blue-50",
      text: "text-blue-700",
    },
    {
      title: "Employees",
      value: stats.totalEmployees,
      subtitle: "Managed staff records",
      icon: Users,
      gradient: "from-emerald-600 to-green-500",
      bg: "bg-emerald-50",
      text: "text-emerald-700",
    },
    {
      title: "Saved Reports",
      value: stats.totalReports,
      subtitle: "Payroll reports stored",
      icon: FileText,
      gradient: "from-purple-600 to-fuchsia-500",
      bg: "bg-purple-50",
      text: "text-purple-700",
    },
    {
      title: "This Month Payroll",
      value: formatMoney(stats.thisMonthPayroll),
      subtitle: formatMonth(currentMonth),
      icon: IndianRupee,
      gradient: "from-orange-600 to-amber-500",
      bg: "bg-orange-50",
      text: "text-orange-700",
    },
  ]

  const quickActions = [
    {
      title: "Add Company",
      description: "Create and manage company workspaces.",
      path: "/companies",
      icon: Building2,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      title: "Add Employee",
      description: "Add employees under each company.",
      path: "/employees",
      icon: Users,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      title: "Manual Attendance",
      description: "Mark daily attendance manually.",
      path: "/attendance",
      icon: CalendarCheck,
      color: "text-orange-700",
      bg: "bg-orange-50",
    },
    {
      title: "Import Punch Report",
      description: "Upload biometric Excel and calculate payroll.",
      path: "/import-punch-report",
      icon: FileSpreadsheet,
      color: "text-purple-700",
      bg: "bg-purple-50",
    },
    {
      title: "Report History",
      description: "Open old saved payroll reports.",
      path: "/report-history",
      icon: History,
      color: "text-slate-700",
      bg: "bg-slate-100",
    },
    {
      title: "Salary Slips",
      description: "Generate employee-wise PDF slips.",
      path: "/salary-slips",
      icon: ReceiptText,
      color: "text-green-700",
      bg: "bg-green-50",
    },
  ]

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-20 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-20 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-8">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-blue-100 px-4 py-2 rounded-full text-sm font-bold">
                <Sparkles size={16} />
                Premium Payroll Workspace
              </p>

              <h1 className="mt-6 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
                Welcome back to AttendBook
              </h1>

              <p className="mt-4 text-slate-300 text-base sm:text-lg leading-relaxed">
                Manage companies, employees, manual attendance, biometric punch
                reports, payroll summaries, salary slips and professional
                exports from one clean dashboard.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  to="/import-punch-report"
                  className="inline-flex items-center gap-2 bg-white text-slate-950 px-5 py-3 rounded-2xl font-black hover:bg-blue-50 transition shadow-xl"
                >
                  Import Punch
                  <ArrowRight size={18} />
                </Link>

                <Link
                  to="/reports"
                  className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-white px-5 py-3 rounded-2xl font-black hover:bg-white/15 transition"
                >
                  View Reports
                  <FileText size={18} />
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 min-w-full sm:min-w-[420px] xl:min-w-[460px]">
              <div className="bg-white/10 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
                <p className="text-slate-300 text-sm">Payroll This Month</p>
                <h2 className="text-2xl sm:text-3xl font-black mt-2">
                  {formatMoney(stats.thisMonthPayroll)}
                </h2>
              </div>

              <div className="bg-white/10 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
                <p className="text-slate-300 text-sm">Reports Saved</p>
                <h2 className="text-2xl sm:text-3xl font-black mt-2">
                  {stats.totalReports}
                </h2>
              </div>

              <div className="bg-white/10 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
                <p className="text-slate-300 text-sm">Companies</p>
                <h2 className="text-2xl sm:text-3xl font-black mt-2">
                  {stats.totalCompanies}
                </h2>
              </div>

              <div className="bg-white/10 border border-white/10 rounded-3xl p-5 backdrop-blur-xl">
                <p className="text-slate-300 text-sm">Employees</p>
                <h2 className="text-2xl sm:text-3xl font-black mt-2">
                  {stats.totalEmployees}
                </h2>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-3xl">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900">
            Business Overview
          </h2>
          <p className="text-slate-500 mt-1">
            Live data from your Firebase workspace.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={refreshing}
          className="inline-flex items-center gap-2 bg-slate-950 text-white px-5 py-3 rounded-2xl font-bold hover:bg-slate-800 disabled:bg-slate-400 transition shadow-lg shadow-slate-900/20"
        >
          <RefreshCw
            size={18}
            className={refreshing ? "animate-spin" : ""}
          />
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div className="premium-card p-8">
          <p className="text-slate-500">Loading dashboard...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {statCards.map((card) => {
              const Icon = card.icon

              return (
                <div
                  key={card.title}
                  className="group bg-white/90 backdrop-blur-xl border border-white/80 rounded-3xl p-6 shadow-xl shadow-slate-200/60 hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-slate-500 font-semibold">
                        {card.title}
                      </p>

                      <h3 className="text-3xl font-black text-slate-900 mt-3 break-words">
                        {card.value}
                      </h3>

                      <p className="text-sm text-slate-400 mt-2">
                        {card.subtitle}
                      </p>
                    </div>

                    <div
                      className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} text-white flex items-center justify-center shadow-lg`}
                    >
                      <Icon size={26} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Recent Payroll Reports
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Latest saved punch payroll reports.
                  </p>
                </div>

                <Link
                  to="/report-history"
                  className="inline-flex items-center gap-2 text-blue-700 font-black hover:text-blue-800"
                >
                  View all
                  <ArrowRight size={17} />
                </Link>
              </div>

              {recentReports.length === 0 ? (
                <div className="text-center py-16 px-6">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                    <FileText size={34} />
                  </div>

                  <h3 className="text-xl font-black text-slate-800 mt-5">
                    No saved reports yet
                  </h3>

                  <p className="text-slate-500 mt-2">
                    Upload a punch report and save it to see recent reports here.
                  </p>

                  <Link
                    to="/import-punch-report"
                    className="mt-6 inline-flex items-center gap-2 bg-blue-700 text-white px-5 py-3 rounded-2xl font-bold hover:bg-blue-800"
                  >
                    Import Punch Report
                    <ArrowRight size={18} />
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentReports.map((report) => (
                    <div
                      key={report.id}
                      className="p-5 hover:bg-slate-50/80 transition"
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center">
                            <FileText size={24} />
                          </div>

                          <div>
                            <h3 className="font-black text-slate-900">
                              {report.reportName}
                            </h3>

                            <p className="text-sm text-slate-500 mt-1">
                              Month: {formatMonth(report.selectedMonth)} |
                              Records: {report.totalRecords || 0}
                            </p>

                            <p className="text-sm text-slate-400 mt-1">
                              File: {report.rawFileName || "-"}
                            </p>
                          </div>
                        </div>

                        <div className="lg:text-right">
                          <p className="font-black text-green-700 text-lg">
                            {formatMoney(report.totalPayroll)}
                          </p>

                          <p className="text-xs text-slate-400 mt-1">
                            {report.createdAtMillis
                              ? new Date(
                                  report.createdAtMillis
                                ).toLocaleString("en-IN")
                              : "-"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    Quick Actions
                  </h2>
                  <p className="text-slate-500 mt-1">
                    Jump into common tasks.
                  </p>
                </div>

                <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center">
                  <TrendingUp size={24} />
                </div>
              </div>

              <div className="space-y-3">
                {quickActions.map((action) => {
                  const Icon = action.icon

                  return (
                    <Link
                      key={action.title}
                      to={action.path}
                      className="group flex items-center gap-4 border border-slate-100 rounded-3xl p-4 hover:bg-slate-50 hover:border-slate-200 transition"
                    >
                      <div
                        className={`w-12 h-12 ${action.bg} ${action.color} rounded-2xl flex items-center justify-center shrink-0`}
                      >
                        <Icon size={23} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-black text-slate-900">
                          {action.title}
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">
                          {action.description}
                        </p>
                      </div>

                      <ArrowRight
                        size={18}
                        className="text-slate-300 group-hover:text-blue-700 group-hover:translate-x-1 transition"
                      />
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default Dashboard