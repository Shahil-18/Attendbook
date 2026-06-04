import { useEffect, useMemo, useState } from "react"
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
import {
  Briefcase,
  Building2,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  Users,
} from "lucide-react"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function Employees() {
  const { currentUser } = useAuth()

  const [companies, setCompanies] = useState([])
  const [employees, setEmployees] = useState([])

  const [formData, setFormData] = useState({
    companyId: "",
    name: "",
    phone: "",
    email: "",
    designation: "",
    salary: "",
  })

  const [selectedCompany, setSelectedCompany] = useState("")
  const [searchText, setSearchText] = useState("")

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const formatMoney = (amount) => {
    if (!amount) return "-"
    return `₹${Number(amount || 0).toFixed(2)}`
  }

  const getCompanyName = (companyId) => {
    const company = companies.find((item) => item.id === companyId)
    return company?.name || company?.companyName || "-"
  }

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const resetForm = () => {
    setFormData((prev) => ({
      companyId: prev.companyId,
      name: "",
      phone: "",
      email: "",
      designation: "",
      salary: "",
    }))
  }

  const fetchData = async () => {
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

      const [companiesSnapshot, employeesSnapshot] = await Promise.all([
        getDocs(companiesQuery),
        getDocs(employeesQuery),
      ])

      const companyList = companiesSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      const employeeList = employeesSnapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      companyList.sort((a, b) =>
        (a.name || a.companyName || "").localeCompare(
          b.name || b.companyName || ""
        )
      )

      employeeList.sort((a, b) => {
        return Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
      })

      setCompanies(companyList)
      setEmployees(employeeList)

      if (companyList.length > 0 && !formData.companyId) {
        setFormData((prev) => ({
          ...prev,
          companyId: companyList[0].id,
        }))
      }
    } catch (err) {
      setError("Failed to load employee data.")
    } finally {
      setLoading(false)
    }
  }

  const addEmployee = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!formData.companyId) {
      setError("Please select company.")
      return
    }

    if (!formData.name.trim()) {
      setError("Employee name is required.")
      return
    }

    if (!currentUser) {
      setError("Please login first.")
      return
    }

    try {
      setSaving(true)

      await addDoc(collection(db, "employees"), {
        caId: currentUser.uid,
        companyId: formData.companyId,
        name: formData.name.trim(),
        employeeName: formData.name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        designation: formData.designation.trim(),
        salary: Number(formData.salary || 0),
        isActive: true,
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now(),
      })

      resetForm()
      setSuccess("Employee added successfully.")
      fetchData()
    } catch (err) {
      setError("Failed to add employee.")
    } finally {
      setSaving(false)
    }
  }

  const deleteEmployee = async (employeeId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this employee?"
    )

    if (!confirmDelete) return

    try {
      await deleteDoc(doc(db, "employees", employeeId))
      setEmployees((prev) =>
        prev.filter((employee) => employee.id !== employeeId)
      )
      setSuccess("Employee deleted successfully.")
      setError("")
    } catch (err) {
      setError("Failed to delete employee.")
    }
  }

  const filteredEmployees = useMemo(() => {
    return employees.filter((employee) => {
      const employeeName =
        employee.name || employee.employeeName || employee.fullName || ""

      const matchesCompany = selectedCompany
        ? employee.companyId === selectedCompany
        : true

      const searchValue = searchText.toLowerCase()

      const matchesSearch =
        employeeName.toLowerCase().includes(searchValue) ||
        employee.phone?.toLowerCase().includes(searchValue) ||
        employee.email?.toLowerCase().includes(searchValue) ||
        employee.designation?.toLowerCase().includes(searchValue)

      return matchesCompany && matchesSearch
    })
  }, [employees, selectedCompany, searchText])

  const activeEmployees = employees.filter((employee) => employee.isActive !== false)

  useEffect(() => {
    fetchData()
  }, [currentUser])

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-emerald-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-emerald-100 px-4 py-2 rounded-full text-sm font-bold">
              <Sparkles size={16} />
              Workforce Management
            </p>

            <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">
              Employees
            </h1>

            <p className="mt-3 text-slate-300 max-w-2xl">
              Add employees company-wise and manage the base records used for
              attendance, payroll and salary reports.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-full sm:min-w-[360px]">
            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Total Employees</p>
              <h2 className="text-3xl font-black mt-2">{employees.length}</h2>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Active Employees</p>
              <h2 className="text-3xl font-black mt-2">
                {activeEmployees.length}
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center">
              <Plus size={24} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Add Employee
              </h2>
              <p className="text-slate-500 text-sm">Create staff record</p>
            </div>
          </div>

          <form onSubmit={addEmployee} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Company *
              </label>
              <select
                name="companyId"
                value={formData.companyId}
                onChange={handleChange}
                className="premium-select"
              >
                <option value="">Select company</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name || company.companyName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Employee Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Employee full name"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Designation
              </label>
              <input
                type="text"
                name="designation"
                value={formData.designation}
                onChange={handleChange}
                placeholder="Accountant, Staff, Manager..."
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Monthly Salary
              </label>
              <input
                type="number"
                name="salary"
                value={formData.salary}
                onChange={handleChange}
                placeholder="Example: 25000"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Phone
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="Contact number"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="employee@example.com"
                className="premium-input"
              />
            </div>

            <button
              type="submit"
              disabled={saving || companies.length === 0}
              className="w-full premium-button-green"
            >
              <Plus size={18} />
              {saving ? "Adding..." : "Add Employee"}
            </button>

            {companies.length === 0 && (
              <p className="text-sm text-red-600">
                Add a company first before adding employees.
              </p>
            )}
          </form>
        </div>

        <div className="xl:col-span-2 bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Employee List
                </h2>
                <p className="text-slate-500 mt-1">
                  Search, filter and manage staff records.
                </p>
              </div>

              <button
                onClick={fetchData}
                disabled={loading}
                className="premium-button-dark"
              >
                <RefreshCw
                  size={18}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
              <div>
                <select
                  value={selectedCompany}
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="premium-select"
                >
                  <option value="">All Companies</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name || company.companyName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2 relative">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Search employee, phone, email or designation"
                  className="premium-input pl-11"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">Loading employees...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                <Users size={34} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mt-5">
                No employees found
              </h3>
              <p className="text-slate-500 mt-2">
                Add your first employee from the form.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredEmployees.map((employee) => {
                const employeeName =
                  employee.name || employee.employeeName || employee.fullName

                return (
                  <div key={employee.id} className="p-5 hover:bg-slate-50/80">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                      <div className="flex items-start gap-4">
                        <div className="w-14 h-14 bg-emerald-50 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
                          <UserRound size={26} />
                        </div>

                        <div>
                          <h3 className="text-lg font-black text-slate-900">
                            {employeeName}
                          </h3>

                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
                            <span className="inline-flex items-center gap-1">
                              <Building2 size={15} />
                              {getCompanyName(employee.companyId)}
                            </span>

                            {employee.designation && (
                              <span className="inline-flex items-center gap-1">
                                <Briefcase size={15} />
                                {employee.designation}
                              </span>
                            )}

                            {employee.salary ? (
                              <span className="font-bold text-green-700">
                                {formatMoney(employee.salary)}
                              </span>
                            ) : null}
                          </div>

                          <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-500">
                            {employee.phone && (
                              <span className="inline-flex items-center gap-1">
                                <Phone size={15} />
                                {employee.phone}
                              </span>
                            )}

                            {employee.email && (
                              <span className="inline-flex items-center gap-1">
                                <Mail size={15} />
                                {employee.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteEmployee(employee.id)}
                        className="inline-flex items-center justify-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-2xl font-bold hover:bg-red-100"
                      >
                        <Trash2 size={17} />
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Employees