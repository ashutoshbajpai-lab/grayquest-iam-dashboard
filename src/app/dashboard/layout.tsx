import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import FilterBar from '@/components/layout/FilterBar'
import FloatingChatBar from '@/components/layout/FloatingChatBar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Outer shell — fixed height so internal panels scroll independently */
    <div className="flex h-screen w-screen p-3 sm:p-4 lg:p-5 gap-3 overflow-hidden bg-bg-primary relative">

      {/* Sidebar — Fixed width, matches parent height exactly */}
      <aside className="hidden lg:flex flex-col w-[240px] flex-shrink-0 rounded-[28px] bg-white/75 backdrop-blur-3xl border border-white/60 shadow-[0_8px_40px_rgba(100,116,180,0.12)] overflow-hidden h-full z-20">
        <Sidebar />
      </aside>

      {/* Main floating container — matches parent height exactly */}
      <div className="flex flex-1 flex-col min-w-0 rounded-[28px] bg-white/70 backdrop-blur-2xl border border-white/55 shadow-[0_8px_40px_rgba(100,116,180,0.12)] overflow-hidden h-full relative z-10">
        <TopBar />
        <FilterBar />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-6 lg:px-8 lg:py-8 scroll-smooth">
          {children}
        </main>
      </div>

      {/* Global floating elements */}
      <FloatingChatBar />
    </div>
  )
}
