import { Badge } from '@/components/ui/badge'
import { motion } from 'framer-motion'

export function SubjectInfoCard({ subject }) {
  const getComponentInfo = (type) => {
    switch (type) {
      case 'L': return { icon: 'ph-book-open', label: 'Lec', color: 'hsl(var(--chart-2))' }
      case 'T': return { icon: 'ph-users', label: 'Tut', color: 'hsl(var(--chart-3))' }
      case 'P': return { icon: 'ph-flask', label: 'Prac', color: 'hsl(var(--chart-1))' }
      default: return null
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
    >
      <div className="wp-card flex-row gap-4">
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <h2 className="text-[15px] font-semibold leading-tight tracking-tight" style={{ color: "hsl(var(--foreground))" }}>
            {subject.name}
          </h2>

          <div className="flex items-center gap-2">
            <span
              className="wp-chip"
              style={{ background: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))", fontFamily: "monospace", fontWeight: 700 }}
            >
              <i className="ph ph-hash" style={{ fontSize: 11 }} />
              {subject.code}
            </span>
            {subject.isAudit && (
              <Badge variant="outline" className="text-[10px] h-5 uppercase font-black border-indigo-500/30 text-indigo-500 bg-indigo-500/5 rounded-md">
                Audit
              </Badge>
            )}
          </div>

          <div className="mt-1 flex flex-col gap-2">
            {subject.components.map((component, idx) => {
              const info = getComponentInfo(component.type);
              return (
                <div key={idx} className="flex items-center gap-2.5">
                  <span
                    className="wp-chip flex-none"
                    style={{ background: `color-mix(in srgb, ${info.color} 15%, transparent)`, color: info.color, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em" }}
                  >
                    <i className={`ph ${info.icon}`} style={{ fontSize: 13 }} />
                    {info.label}
                  </span>
                  <span className="text-xs sm:text-sm font-medium truncate" style={{ color: "hsl(var(--foreground))", opacity: 0.8 }}>
                    {component.teacher}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-4 py-4 min-w-[60px] h-fit self-center"
          style={{ background: "hsl(var(--accent))", border: "1px solid hsl(var(--border))" }}
        >
          <span className="text-xl font-black leading-none" style={{ color: "hsl(var(--accent-foreground))" }}>
            {subject.credits.toFixed(1)}
          </span>
          <span className="text-[10px] font-black uppercase tracking-[0.1em] mt-1" style={{ color: "hsl(var(--accent-foreground))", opacity: 0.6 }}>
            Credits
          </span>
        </div>
      </div>
    </motion.div>
  )
}

export default SubjectInfoCard
