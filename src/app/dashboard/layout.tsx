import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import FilterBar from '@/components/layout/FilterBar'
import FloatingChatBar from '@/components/layout/FloatingChatBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg-primary">
      {/* Left sidebar */}
      <Sidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <FilterBar />
        <main className="flex-1 px-6 py-6 max-w-screen-2xl w-full">
          {children}
        </main>
      </div>

      <FloatingChatBar />
    </div>
  )
}
