import { useState } from "react"
import { Link } from "react-router-dom"
import { Menu, Sparkles } from "lucide-react"
import Sidebar from "./Sidebar"

function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-72 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="lg:hidden sticky top-0 z-40 bg-white/85 backdrop-blur-2xl border-b border-white/70 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link
          to="/dashboard"
          className="flex items-center gap-3"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="w-11 h-11 bg-gradient-to-br from-blue-700 to-slate-950 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-blue-700/20">
            A
          </div>

          <div>
            <h1 className="text-xl font-black text-slate-900 leading-tight">
              AttendBook
            </h1>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles size={12} />
              CA Attendance & Payroll
            </p>
          </div>
        </Link>

        <button
          onClick={() => setSidebarOpen(true)}
          className="p-3 rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/20"
        >
          <Menu size={22} />
        </button>
      </div>

      <div className="flex">
        <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

        <main className="flex-1 w-full lg:ml-72 p-4 sm:p-6 lg:p-8">
          <div className="max-w-[1650px] mx-auto">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default MainLayout