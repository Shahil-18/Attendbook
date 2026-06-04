import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react"
import { auth, db } from "../firebase/firebaseConfig"

function Signup() {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    name: "",
    firmName: "",
    email: "",
    password: "",
    confirmPassword: "",
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const getFirebaseErrorMessage = (code) => {
    if (code === "auth/email-already-in-use") {
      return "This email is already registered. Please login instead."
    }

    if (code === "auth/invalid-email") {
      return "Please enter a valid email address."
    }

    if (code === "auth/weak-password") {
      return "Password should be at least 6 characters."
    }

    return "Signup failed. Please try again."
  }

  const validateForm = () => {
    if (!formData.name.trim()) {
      return "Please enter your name."
    }

    if (!formData.firmName.trim()) {
      return "Please enter firm or company name."
    }

    if (!formData.email.trim()) {
      return "Please enter email address."
    }

    if (formData.password.length < 6) {
      return "Password must be at least 6 characters."
    }

    if (formData.password !== formData.confirmPassword) {
      return "Password and confirm password do not match."
    }

    return ""
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    const validationError = validateForm()

    if (validationError) {
      setError(validationError)
      return
    }

    try {
      setLoading(true)

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email.trim(),
        formData.password
      )

      const user = userCredential.user

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: formData.name.trim(),
        firmName: formData.firmName.trim(),
        email: formData.email.trim(),
        role: "ca",
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now(),
      })

      await setDoc(
        doc(db, "userSettings", user.uid),
        {
          caId: user.uid,
          firmName: formData.firmName.trim() || "AttendBook",
          firmOwnerName: formData.name.trim(),
          contactNumber: "",
          email: formData.email.trim(),
          address: "",
          defaultWorkingDays: 26,
          defaultStandardHours: 8,
          overtimeEnabled: true,
          overtimeMultiplier: 1.5,
          duplicatePunchMinutes: 2,
          halfDayMinimumHours: 4,
          fullDayMinimumHours: 8,
          updatedAt: serverTimestamp(),
          updatedAtMillis: Date.now(),
        },
        { merge: true }
      )

      navigate("/dashboard")
    } catch (err) {
      setError(getFirebaseErrorMessage(err.code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-120px] right-[-120px] w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-120px] left-[-120px] w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"></div>
      <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 bg-white/10 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden relative z-10">
        <div className="bg-white p-6 sm:p-10 lg:p-14">
          <div className="lg:hidden mb-8">
            <div className="inline-flex items-center gap-3">
              <div className="w-11 h-11 bg-blue-700 text-white rounded-xl flex items-center justify-center font-black text-xl">
                A
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  AttendBook
                </h1>
                <p className="text-sm text-gray-500">CA Attendance & Payroll</p>
              </div>
            </div>
          </div>

          <div className="max-w-md mx-auto">
            <div className="mb-8">
              <p className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold">
                <Sparkles size={16} />
                Start your workspace
              </p>

              <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-5">
                Create your account
              </h2>

              <p className="text-gray-500 mt-3">
                Set up your attendance and payroll workspace in a minute.
              </p>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Your Name
                </label>

                <div className="relative">
                  <User
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter your name"
                    className="w-full border border-gray-300 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Firm / Company Name
                </label>

                <div className="relative">
                  <Building2
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    name="firmName"
                    value={formData.firmName}
                    onChange={handleChange}
                    placeholder="Example: Sharma & Associates"
                    className="w-full border border-gray-300 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>

                <div className="relative">
                  <Mail
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    className="w-full border border-gray-300 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>

                <div className="relative">
                  <Lock
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Minimum 6 characters"
                    className="w-full border border-gray-300 rounded-2xl pl-12 pr-12 py-4 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>

                <div className="relative">
                  <Lock
                    size={19}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Re-enter password"
                    className="w-full border border-gray-300 rounded-2xl pl-12 pr-12 py-4 outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition"
                  />

                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-300 text-white rounded-2xl py-4 font-bold flex items-center justify-center gap-2 transition shadow-lg shadow-blue-700/20"
              >
                {loading ? "Creating account..." : "Create Account"}
                {!loading && <ArrowRight size={19} />}
              </button>
            </form>

            <p className="text-center text-gray-500 mt-8">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-bold text-blue-700 hover:text-blue-800"
              >
                Login
              </Link>
            </p>
          </div>
        </div>

        <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-slate-950 via-blue-950 to-blue-700 text-white">
          <div>
            <div className="inline-flex items-center gap-3 bg-white/10 border border-white/10 rounded-2xl px-4 py-3">
              <div className="w-11 h-11 bg-white text-blue-700 rounded-xl flex items-center justify-center font-black text-xl">
                A
              </div>
              <div>
                <h1 className="text-2xl font-bold">AttendBook</h1>
                <p className="text-sm text-blue-100">
                  CA Attendance & Payroll
                </p>
              </div>
            </div>

            <div className="mt-16">
              <h2 className="text-5xl font-extrabold leading-tight">
                Build a premium payroll workspace from day one.
              </h2>
              <p className="mt-6 text-blue-100 text-lg leading-relaxed">
                Add companies, manage employees, mark attendance, import punch
                reports, calculate payroll and generate professional salary
                slips.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
              <ShieldCheck className="text-green-300 mb-3" size={26} />
              <p className="font-semibold">Firebase Auth</p>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
              <Sparkles className="text-yellow-300 mb-3" size={26} />
              <p className="font-semibold">Payroll Ready</p>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-2xl p-4">
              <FileIcon />
              <p className="font-semibold">PDF Exports</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FileIcon() {
  return <div className="text-blue-300 mb-3 font-bold text-2xl">PDF</div>
}

export default Signup