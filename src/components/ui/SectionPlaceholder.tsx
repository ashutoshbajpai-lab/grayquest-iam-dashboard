export default function SectionPlaceholder({ section }: { section: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-4">
        <span className="text-accent text-xl font-bold">{section[0].toUpperCase()}</span>
      </div>
      <p className="text-txt-secondary font-medium">{section} section</p>
      <p className="text-xs text-txt-muted mt-1">Coming in the next phase</p>
    </div>
  )
}
