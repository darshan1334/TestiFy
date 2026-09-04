import Sidebar from './Sidebar'
import Header from './Header'

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <Header />
        <main className="page-content grid-bg">
          {children}
        </main>
      </div>
    </div>
  )
}
