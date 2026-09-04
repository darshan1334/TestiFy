import AdminSidebar from './AdminSidebar'
import Header from './Header'

export default function AdminLayout({ children }) {
  return (
    <div className="app-layout">
      <AdminSidebar />
      <div className="main-area">
        <Header />
        <main className="page-content grid-bg">
          {children}
        </main>
      </div>
    </div>
  )
}
