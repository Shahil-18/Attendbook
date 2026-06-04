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
  Building2,
  Plus,
  Search,
  Trash2,
  RefreshCw,
  Sparkles,
  MapPin,
  Phone,
  Mail,
} from "lucide-react"
import { db } from "../firebase/firebaseConfig"
import { useAuth } from "../context/AuthContext"

function Companies() {
  const { currentUser } = useAuth()

  const [companies, setCompanies] = useState([])
  const [formData, setFormData] = useState({
    name: "",
    ownerName: "",
    phone: "",
    email: "",
    address: "",
  })

  const [searchText, setSearchText] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const resetForm = () => {
    setFormData({
      name: "",
      ownerName: "",
      phone: "",
      email: "",
      address: "",
    })
  }

  const fetchCompanies = async () => {
    if (!currentUser) return

    try {
      setLoading(true)
      setError("")

      const q = query(
        collection(db, "companies"),
        where("caId", "==", currentUser.uid)
      )

      const snapshot = await getDocs(q)

      const companyList = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data(),
      }))

      companyList.sort((a, b) => {
        return Number(b.createdAtMillis || 0) - Number(a.createdAtMillis || 0)
      })

      setCompanies(companyList)
    } catch (err) {
      setError("Failed to load companies.")
    } finally {
      setLoading(false)
    }
  }

  const addCompany = async (e) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    if (!formData.name.trim()) {
      setError("Company name is required.")
      return
    }

    if (!currentUser) {
      setError("Please login first.")
      return
    }

    try {
      setSaving(true)

      await addDoc(collection(db, "companies"), {
        caId: currentUser.uid,
        name: formData.name.trim(),
        companyName: formData.name.trim(),
        ownerName: formData.ownerName.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        createdAt: serverTimestamp(),
        createdAtMillis: Date.now(),
      })

      resetForm()
      setSuccess("Company added successfully.")
      fetchCompanies()
    } catch (err) {
      setError("Failed to add company.")
    } finally {
      setSaving(false)
    }
  }

  const deleteCompany = async (companyId) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this company?"
    )

    if (!confirmDelete) return

    try {
      await deleteDoc(doc(db, "companies", companyId))
      setCompanies((prev) => prev.filter((company) => company.id !== companyId))
      setSuccess("Company deleted successfully.")
      setError("")
    } catch (err) {
      setError("Failed to delete company.")
    }
  }

  const filteredCompanies = useMemo(() => {
    return companies.filter((company) => {
      const searchValue = searchText.toLowerCase()

      return (
        company.name?.toLowerCase().includes(searchValue) ||
        company.companyName?.toLowerCase().includes(searchValue) ||
        company.ownerName?.toLowerCase().includes(searchValue) ||
        company.phone?.toLowerCase().includes(searchValue) ||
        company.email?.toLowerCase().includes(searchValue)
      )
    })
  }, [companies, searchText])

  useEffect(() => {
    fetchCompanies()
  }, [currentUser])

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 text-white shadow-2xl">
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/30 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-600/30 rounded-full blur-3xl"></div>
        </div>

        <div className="relative p-6 sm:p-8 lg:p-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <p className="inline-flex items-center gap-2 bg-white/10 border border-white/10 text-blue-100 px-4 py-2 rounded-full text-sm font-bold">
              <Sparkles size={16} />
              Client Workspace
            </p>

            <h1 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight">
              Companies
            </h1>

            <p className="mt-3 text-slate-300 max-w-2xl">
              Add and manage client companies. Employees, attendance and payroll
              can be organized company-wise.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 min-w-full sm:min-w-[360px]">
            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Total Companies</p>
              <h2 className="text-3xl font-black mt-2">{companies.length}</h2>
            </div>

            <div className="bg-white/10 border border-white/10 rounded-3xl p-5">
              <p className="text-slate-300 text-sm">Visible Results</p>
              <h2 className="text-3xl font-black mt-2">
                {filteredCompanies.length}
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
            <div className="w-12 h-12 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center">
              <Plus size={24} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                Add Company
              </h2>
              <p className="text-slate-500 text-sm">Create new client space</p>
            </div>
          </div>

          <form onSubmit={addCompany} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Company Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Example: Sharma Traders"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Owner / Contact Person
              </label>
              <input
                type="text"
                name="ownerName"
                value={formData.ownerName}
                onChange={handleChange}
                placeholder="Owner name"
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
                placeholder="company@example.com"
                className="premium-input"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows="3"
                placeholder="Office address"
                className="premium-input"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full premium-button-primary"
            >
              <Plus size={18} />
              {saving ? "Adding..." : "Add Company"}
            </button>
          </form>
        </div>

        <div className="xl:col-span-2 bg-white/90 backdrop-blur-xl border border-white/80 rounded-[2rem] shadow-xl shadow-slate-200/60 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900">
                  Company List
                </h2>
                <p className="text-slate-500 mt-1">
                  Search, view and manage companies.
                </p>
              </div>

              <button
                onClick={fetchCompanies}
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

            <div className="relative mt-5">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search company, owner, phone or email"
                className="premium-input pl-11"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-slate-500">Loading companies...</div>
          ) : filteredCompanies.length === 0 ? (
            <div className="text-center py-16 px-6">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto">
                <Building2 size={34} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mt-5">
                No companies found
              </h3>
              <p className="text-slate-500 mt-2">
                Add your first company from the form.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredCompanies.map((company) => (
                <div key={company.id} className="p-5 hover:bg-slate-50/80">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 bg-blue-50 text-blue-700 rounded-2xl flex items-center justify-center shrink-0">
                        <Building2 size={26} />
                      </div>

                      <div>
                        <h3 className="text-lg font-black text-slate-900">
                          {company.name || company.companyName}
                        </h3>

                        {company.ownerName && (
                          <p className="text-sm text-slate-500 mt-1">
                            Owner: {company.ownerName}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-3 text-sm text-slate-500">
                          {company.phone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={15} />
                              {company.phone}
                            </span>
                          )}

                          {company.email && (
                            <span className="inline-flex items-center gap-1">
                              <Mail size={15} />
                              {company.email}
                            </span>
                          )}

                          {company.address && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={15} />
                              {company.address}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => deleteCompany(company.id)}
                      className="inline-flex items-center justify-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-2xl font-bold hover:bg-red-100"
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
      </div>
    </div>
  )
}

export default Companies