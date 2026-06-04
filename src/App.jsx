import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"

import Login from "./pages/Login"
import Signup from "./pages/Signup"
import Dashboard from "./pages/Dashboard"
import Companies from "./pages/Companies"
import Employees from "./pages/Employees"
import Attendance from "./pages/Attendance"
import Reports from "./pages/Reports"
import Settings from "./pages/Settings"
import ImportPunchReport from "./pages/ImportPunchReport"
import ReportHistory from "./pages/ReportHistory"
import SalarySlips from "./pages/SalarySlips"

import ProtectedRoute from "./components/ProtectedRoute"
import MainLayout from "./components/MainLayout"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Dashboard />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/companies"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Companies />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Employees />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/attendance"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Attendance />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/import-punch-report"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ImportPunchReport />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/report-history"
          element={
            <ProtectedRoute>
              <MainLayout>
                <ReportHistory />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/salary-slips"
          element={
            <ProtectedRoute>
              <MainLayout>
                <SalarySlips />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Reports />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <MainLayout>
                <Settings />
              </MainLayout>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App