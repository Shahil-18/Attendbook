import { NavLink, Link, useNavigate } from "react-router-dom"
import {
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  FileText,
  Settings,
  LogOut,
  FileSpreadsheet,
  History,
  ReceiptText,
  X,
  Sparkles,
} from "lucide-react"
import { useAuth } from "../context/AuthContext"

function Sidebar({ sidebarOpen, setSidebarOpen }) {
  const navigate = useNavigate()
  const { logout, currentUser } = useAuth()

  const handleLogout = async () => {
    await logout()
    setSidebarOpen?.(false)
    navigate("/login")
  }

  const closeMobileSidebar = () => {
    setSidebarOpen?.(false)
  }

  const navClass = ({ isActive }) =>
    `group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 ${
      isActive
        ? "bg-gradient-to-r from-blue-700 to-blue-600 text-white shadow-lg shadow-blue-900/30"
        : "text-slate-300 hover:bg-white/10 hover:text-white"
    }`

  return (
    <>
      {sidebarOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden"
        ></div>
      )}

      <aside
        className={`fixed top-0 left-0 z-50 w-72 h-screen bg-slate-950 text-white flex flex-col transform transition-transform duration-300 border-r border-white/10
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-blue-600/25 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -right-32 w-64 h-64 bg-purple-600/20 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 border-b border-white/10 flex items-start justify-between gap-4">
          <Link
            to="/dashboard"
            onClick={closeMobileSidebar}
            className="flex items-center gap-3"
          >
            <div className="w-12 h-12 bg-white text-blue-700 rounded-2xl flex items-center justify-center font-black text-2xl shadow-xl">
              A
            </div>

            <div>
              <h1 className="text-2xl font-black leading-tight text-white">
                AttendBook
              </h1>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <Sparkles size={12} />
                CA Attendance & Payroll
              </p>
            </div>
          </Link>

          <button
            onClick={closeMobileSidebar}
            className="lg:hidden p-2 rounded-2xl bg-white/10 text-slate-200 hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="relative flex-1 p-4 space-y-2 overflow-y-auto">
          <NavLink
            to="/dashboard"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <LayoutDashboard size={20} />
            <span className="font-semibold">Dashboard</span>
          </NavLink>

          <NavLink
            to="/companies"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <Building2 size={20} />
            <span className="font-semibold">Companies</span>
          </NavLink>

          <NavLink
            to="/employees"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <Users size={20} />
            <span className="font-semibold">Employees</span>
          </NavLink>

          <NavLink
            to="/attendance"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <CalendarCheck size={20} />
            <span className="font-semibold">Attendance</span>
          </NavLink>

          <div className="pt-3 pb-1">
            <p className="px-4 text-[11px] uppercase tracking-widest text-slate-500 font-black">
              Payroll
            </p>
          </div>

          <NavLink
            to="/import-punch-report"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <FileSpreadsheet size={20} />
            <span className="font-semibold">Import Punch</span>
          </NavLink>

          <NavLink
            to="/report-history"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <History size={20} />
            <span className="font-semibold">Report History</span>
          </NavLink>

          <NavLink
            to="/salary-slips"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <ReceiptText size={20} />
            <span className="font-semibold">Salary Slips</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <FileText size={20} />
            <span className="font-semibold">Reports</span>
          </NavLink>

          <div className="pt-3 pb-1">
            <p className="px-4 text-[11px] uppercase tracking-widest text-slate-500 font-black">
              System
            </p>
          </div>

          <NavLink
            to="/settings"
            className={navClass}
            onClick={closeMobileSidebar}
          >
            <Settings size={20} />
            <span className="font-semibold">Settings</span>
          </NavLink>
        </nav>

        <div className="relative p-4 border-t border-white/10">
          <div className="bg-white/10 border border-white/10 rounded-3xl p-4 mb-4">
            <p className="text-xs text-slate-400 mb-1">Logged in as</p>

            <p className="text-sm text-white font-semibold truncate">
              {currentUser?.email}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 py-3 rounded-2xl font-bold shadow-lg shadow-red-950/30 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}

export default Sidebar