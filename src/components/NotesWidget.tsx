import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { marked } from 'marked'
import { Plus, X, Eye, Pencil } from 'lucide-react'
import type { Note } from '../types'
import { getStoredPositions, savePositions, type NotePosition } from '../lib/notePositions'
import { markdownEnabled } from '../lib/notesSettings'

const NOTE_COLORS = ['var(--note-blue)', 'var(--note-pink)', 'var(--note-yellow)', 'var(--note-green)']
const NOTE_WIDTH = 176
const NOTE_HEIGHT = 160
const GAP = 16
const COLS = 4

function colorFor(id: string) {
  let hash = 0
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return NOTE_COLORS[hash % NOTE_COLORS.length]
}

function defaultPosition(index: number): NotePosition {
  return {
    x: (index % COLS) * (NOTE_WIDTH + GAP),
    y: Math.floor(index / COLS) * (NOTE_HEIGHT + GAP),
  }
}

export default function NotesWidget() {
  const [notes, setNotes] = useState<Note[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [positions, setPositions] = useState<Record<string, NotePosition>>(getStoredPositions())
  const [previewing, setPreviewing] = useState<Record<string, boolean>>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const showMarkdownToggle = markdownEnabled()

  async function refresh() {
    const list = await window.api.notes.list()
    setNotes(list)
    setDrafts((prev) => {
      const next = { ...prev }
      for (const n of list) if (!(n.id in next)) next[n.id] = n.content
      return next
    })
  }

  useEffect(() => {
    refresh()
    return window.api.onSyncChanged(() => refresh())
  }, [])

  async function addNote() {
    await window.api.notes.add()
    refresh()
  }

  async function updateContent(id: string, content: string) {
    setDrafts((prev) => ({ ...prev, [id]: content }))
    const note = notes.find((n) => n.id === id)
    if (note) await window.api.notes.update(id, note.title, content)
  }

  async function remove(id: string) {
    await window.api.notes.delete(id)
    refresh()
  }

  function togglePreview(id: string) {
    setPreviewing((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function positionOf(noteId: string, index: number): NotePosition {
    return positions[noteId] ?? defaultPosition(index)
  }

  function handleDragEnd(noteId: string, index: number, info: PanInfo) {
    const base = positionOf(noteId, index)
    const next = { ...positions, [noteId]: { x: base.x + info.offset.x, y: base.y + info.offset.y } }
    setPositions(next)
    savePositions(next)
  }

  const rows = Math.ceil(notes.length / COLS)
  const minHeight = Math.max(rows, 1) * (NOTE_HEIGHT + GAP)

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
          Notes desk
        </h3>
        <button
          onClick={addNote}
          className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium text-white transition-transform active:scale-[0.95]"
          style={{ background: 'var(--accent)' }}
        >
          <Plus size={11} strokeWidth={2.5} />
          Add note
        </button>
      </div>
      <div ref={containerRef} className="relative" style={{ minHeight }}>
        <AnimatePresence initial={false}>
          {notes.map((note, i) => {
            const pos = positionOf(note.id, i)
            const isPreview = showMarkdownToggle && previewing[note.id]
            return (
              <motion.div
                key={note.id}
                drag
                dragMomentum={false}
                dragConstraints={containerRef}
                onDragEnd={(_e, info) => handleDragEnd(note.id, i, info)}
                initial={{ opacity: 0, scale: 0.9, x: pos.x, y: pos.y }}
                animate={{ opacity: 1, scale: 1, x: pos.x, y: pos.y }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileDrag={{ scale: 1.04, zIndex: 10, boxShadow: '0 12px 24px rgba(0,0,0,0.25)' }}
                className="absolute flex cursor-grab flex-col rounded-xl p-2.5 shadow-sm active:cursor-grabbing"
                style={{ background: colorFor(note.id), width: NOTE_WIDTH, height: NOTE_HEIGHT, top: 0, left: 0 }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-black/10" />
                    <span className="h-2 w-2 rounded-full bg-black/10" />
                    <span className="h-2 w-2 rounded-full bg-black/10" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {showMarkdownToggle && (
                      <button
                        onClick={() => togglePreview(note.id)}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        className="text-black/40 hover:text-black/70"
                      >
                        {isPreview ? <Pencil size={11} /> : <Eye size={11} />}
                      </button>
                    )}
                    <button onClick={() => remove(note.id)} className="text-black/40 hover:text-black/70">
                      <X size={12} />
                    </button>
                  </div>
                </div>
                {isPreview ? (
                  <div
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    className="markdown-body flex-1 overflow-y-auto text-[12px] leading-snug text-black/80"
                    dangerouslySetInnerHTML={{ __html: marked.parse(drafts[note.id] ?? '', { async: false }) }}
                  />
                ) : (
                  <textarea
                    value={drafts[note.id] ?? ''}
                    onChange={(e) => updateContent(note.id, e.target.value)}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    placeholder="Write a note..."
                    className="flex-1 resize-none bg-transparent text-[12px] leading-snug text-black/80 placeholder:text-black/40"
                  />
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
        {notes.length === 0 && (
          <p className="py-6 text-[11px]" style={{ color: 'var(--text-faint)' }}>
            No notes yet — add one to start your desk.
          </p>
        )}
      </div>
    </div>
  )
}
