export async function exportBackup() {
  const snapshot = await window.api.data.exportAll()
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `omniflow-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function pickBackupFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.click()
  })
}

export async function importBackupFromFile(file: File): Promise<{ imported: number }> {
  const text = await file.text()
  const snapshot = JSON.parse(text)
  return window.api.data.importAll(snapshot)
}
