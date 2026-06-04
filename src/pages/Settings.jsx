import { useEffect, useState } from "react"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import {
  Building2,
  Clock,
  RotateCcw,
  Save,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Timer,
  UserRound,
} from "lucide-react"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function Settings() {
  const { currentUser } = useAuth()

  const SETTINGS_STORAGE_KEY = "attendbook_app_settings"

  const defaultSettings = {
    firmName: "",
    firmOwnerName: "",
    contactNumber: "",
    email: "",
    address: "",
    defaultWorkingDays: 26,
    defaultStandardHours: 8,
    overtimeEnabled: true,
    overtimeMultiplier: 1.5,
    duplicatePunchMinutes: 2,
    halfDayMinimumHours: 4,
    fullDayMinimumHours: 8,
  }

  const [settings, setSettings] = useState(defaultSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [settingsSource, setSettingsSource] = useState("Default")

  const updateField = (field, value) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const loadSettings = async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      setError("")
      setSuccess("")

      const settingsRef = doc(db, "userSettings", currentUser.uid)
      const settingsSnap = await getDoc(settingsRef)

      if (settingsSnap.exists()) {
        const firebaseSettings = settingsSnap.data()

        const finalSettings = {
          ...defaultSettings,
          ...firebaseSettings,
        }

        setSettings(finalSettings)
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(finalSettings))
        setSettingsSource("Firebase")
        return
      }

      const localSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)

      if (localSettings) {
        const parsedLocalSettings = JSON.parse(localSettings)

        setSettings({
          ...defaultSettings,
          ...parsedLocalSettings,
        })

        setSettingsSource("Local Backup")
        return
      }

      setSettings(defaultSettings)
      setSettingsSource("Default")
    } catch (err) {
      console.error(err)

      const localSettings = localStorage.getItem(SETTINGS_STORAGE_KEY)

      if (localSettings) {
        setSettings({
          ...defaultSettings,
          ...JSON.parse(localSettings),
        })

        setSettingsSource("Local Backup")
      } else {
        setError("Failed to load settings.")
        setSettingsSource("Default")
      }
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!currentUser) {
      setError("Please login first.")
      return
    }

    try {
      setSaving(true)
      setError("")
      setSuccess("")

      const cleanSettings = {
        firmName: String(settings.firmName || "").trim(),
        firmOwnerName: String(settings.firmOwnerName || "").trim(),
        contactNumber: String(settings.contactNumber || "").trim(),
        email: String(settings.email || "").trim(),
        address: String(settings.address || "").trim(),

        defaultWorkingDays: Number(settings.defaultWorkingDays || 26),
        defaultStandardHours: Number(settings.defaultStandardHours || 8),

        overtimeEnabled: Boolean(settings.overtimeEnabled),
        overtimeMultiplier: Number(settings.overtimeMultiplier || 1.5),

        duplicatePunchMinutes: Number(settings.duplicatePunchMinutes || 2),
        halfDayMinimumHours: Number(settings.halfDayMinimumHours || 4),
        fullDayMinimumHours: Number(settings.fullDayMinimumHours || 8),

        userId: currentUser.uid,
        updatedAt: serverTimestamp(),
        updatedAtMillis: Date.now(),
      }

      await setDoc(doc(db, "userSettings", currentUser.uid), cleanSettings, {
        merge: true,
      })

      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cleanSettings))

      setSettings(cleanSettings)
      setSettingsSource("Firebase")
      setSuccess("Settings saved successfully.")
    } catch (err) {
      console.error(err)
      setError("Failed to save settings.")
    } finally {
      setSaving(false)
    }
  }

  const resetSettings = () => {
    const confirmReset = window.confirm(
      "Are you sure you want to reset settings to default?"
    )

    if (!confirmReset) return

    setSettings(defaultSettings)
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings))
    setSettingsSource("Default")
    setSuccess("Settings reset to default. Click Save Settings to update Firebase.")
    setError("")
  }

  useEffect(() => {
    loadSettings()
  }, [currentUser])

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl p-8 text-center">
          <div className="w-14 h-14 border-4 border-blue-200 border-t-blue-700 rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-semibold mt-5">
            Loading settings...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          <div>
            <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-blue-100 px-4 py-2 rounded-full text-sm font-bold">
              <Sparkles size={16} />
              AttendBook Control Panel
            </p>

            <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
              Settings
            </h1>

            <p className="mt-4 text-slate-300 max-w-3xl leading-relaxed">
              Manage firm details, payroll defaults, overtime rules, punch
              processing rules and salary slip information.
            </p>
          </div>

          <div className="bg-white/10 border border-white/10 rounded-3xl p-5 min-w-full sm:min-w-[330px] lg:min-w-[360px]">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white text-blue-700 rounded-2xl flex items-center justify-center">
                <ShieldCheck size={25} />
              </div>

              <div>
                <p className="text-slate-300 text-sm">Settings Source</p>
                <h2 className="text-2xl font-black">{settingsSource}</h2>
              </div>
            </div>

            <p className="text-slate-300 text-sm mt-4">
              Saved settings are used in punch report, salary calculation and
              salary slip generation.
            </p>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-2 bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center">
              <Building2 size={25} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Firm Profile
              </h2>
              <p className="text-slate-500 text-sm">
                These details will be used in salary slips and reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Firm / Company Name
              </label>
              <input
                type="text"
                value={settings.firmName}
                onChange={(e) => updateField("firmName", e.target.value)}
                placeholder="Example: AttendBook Services"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Owner / CA Name
              </label>
              <input
                type="text"
                value={settings.firmOwnerName}
                onChange={(e) => updateField("firmOwnerName", e.target.value)}
                placeholder="Example: Shahil Sharma"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Contact Number
              </label>
              <input
                type="text"
                value={settings.contactNumber}
                onChange={(e) => updateField("contactNumber", e.target.value)}
                placeholder="Example: 9876543210"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => updateField("email", e.target.value)}
                placeholder="example@email.com"
                className="premium-input"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Address
              </label>
              <textarea
                value={settings.address}
                onChange={(e) => updateField("address", e.target.value)}
                placeholder="Firm address"
                rows="4"
                className="premium-input resize-none"
              ></textarea>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-50 text-purple-700 rounded-2xl flex items-center justify-center">
              <SettingsIcon size={25} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">Actions</h2>
              <p className="text-slate-500 text-sm">
                Save or reset your app settings.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="w-full premium-button-primary"
            >
              <Save size={18} />
              {saving ? "Saving..." : "Save Settings"}
            </button>

            <button
              onClick={resetSettings}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 px-5 py-3 rounded-2xl font-bold transition flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Reset Default
            </button>
          </div>

          <div className="mt-6 bg-slate-50 border border-slate-100 rounded-3xl p-5">
            <p className="text-sm text-slate-500">Logged in as</p>
            <p className="font-black text-slate-900 mt-1 break-all">
              {currentUser?.email || "-"}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-green-50 text-green-700 rounded-2xl flex items-center justify-center">
              <Clock size={25} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Payroll Defaults
              </h2>
              <p className="text-slate-500 text-sm">
                Default values used for salary calculation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Default Working Days
              </label>
              <input
                type="number"
                value={settings.defaultWorkingDays}
                onChange={(e) =>
                  updateField("defaultWorkingDays", Number(e.target.value))
                }
                min="1"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Default Standard Hours / Day
              </label>
              <input
                type="number"
                value={settings.defaultStandardHours}
                onChange={(e) =>
                  updateField("defaultStandardHours", Number(e.target.value))
                }
                min="1"
                step="0.5"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Overtime Multiplier
              </label>
              <input
                type="number"
                value={settings.overtimeMultiplier}
                onChange={(e) =>
                  updateField("overtimeMultiplier", Number(e.target.value))
                }
                min="1"
                step="0.1"
                className="premium-input"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-3 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 w-full cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.overtimeEnabled}
                  onChange={(e) =>
                    updateField("overtimeEnabled", e.target.checked)
                  }
                  className="w-5 h-5"
                />
                <span className="font-bold text-slate-700">
                  Overtime Enabled
                </span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-orange-50 text-orange-700 rounded-2xl flex items-center justify-center">
              <Timer size={25} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Punch Processing Rules
              </h2>
              <p className="text-slate-500 text-sm">
                Rules used while importing biometric punch reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Duplicate Punch Window
              </label>
              <input
                type="number"
                value={settings.duplicatePunchMinutes}
                onChange={(e) =>
                  updateField("duplicatePunchMinutes", Number(e.target.value))
                }
                min="0"
                className="premium-input"
              />
              <p className="text-xs text-slate-500 mt-2">In minutes</p>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Half Day Minimum Hours
              </label>
              <input
                type="number"
                value={settings.halfDayMinimumHours}
                onChange={(e) =>
                  updateField("halfDayMinimumHours", Number(e.target.value))
                }
                min="0"
                step="0.5"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Full Day Minimum Hours
              </label>
              <input
                type="number"
                value={settings.fullDayMinimumHours}
                onChange={(e) =>
                  updateField("fullDayMinimumHours", Number(e.target.value))
                }
                min="0"
                step="0.5"
                className="premium-input"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center">
            <UserRound size={25} />
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900">
              Current Rules Preview
            </h2>
            <p className="text-slate-500 text-sm">
              Quick view of how AttendBook will calculate attendance and salary.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          <PreviewCard
            title="Working Days"
            value={`${settings.defaultWorkingDays} days`}
          />
          <PreviewCard
            title="Standard Hours"
            value={`${settings.defaultStandardHours} hrs/day`}
          />
          <PreviewCard
            title="Half Day"
            value={`${settings.halfDayMinimumHours}+ hrs`}
          />
          <PreviewCard
            title="Full Day"
            value={`${settings.fullDayMinimumHours}+ hrs`}
          />
          <PreviewCard
            title="Duplicate Punch"
            value={`${settings.duplicatePunchMinutes} min`}
          />
          <PreviewCard
            title="Overtime"
            value={
              settings.overtimeEnabled
                ? `${settings.overtimeMultiplier}x enabled`
                : "Disabled"
            }
          />
          <PreviewCard
            title="Firm"
            value={settings.firmName || "Not set"}
          />
          <PreviewCard
            title="Owner / CA"
            value={settings.firmOwnerName || "Not set"}
          />
        </div>
      </div>
    </div>
  )
}

function PreviewCard({ title, value }) {
  return (
    <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5">
      <p className="text-slate-500 text-sm">{title}</p>
      <h3 className="text-lg font-black text-slate-900 mt-2 break-words">
        {value}
      </h3>
    </div>
  )
}

export default Settings