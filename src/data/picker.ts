// Google Picker, used by an assistant coach to open the FlipTurn folder the
// head coach shared with them. With the drive.file scope, FlipTurn can only see
// Drive files it created or that the coach picks here.

const API_SRC = 'https://apis.google.com/js/api.js'
const FOLDER_MIME = 'application/vnd.google-apps.folder'

export const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY ?? ''
export const googleAppId = import.meta.env.VITE_GOOGLE_APP_ID ?? ''
export const pickerAvailable = Boolean(googleApiKey && googleAppId)

interface PickedDoc {
  id: string
  name: string
  mimeType: string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: { load(name: string, callback: () => void): void }
  }
}

let pickerPromise: Promise<any> | null = null

function loadPicker(): Promise<any> {
  pickerPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = API_SRC
    script.async = true
    script.onload = () => window.gapi!.load('picker', () => resolve((window as any).google.picker))
    script.onerror = () => {
      pickerPromise = null
      reject(new Error('Could not load the Google file picker. Check your connection.'))
    }
    document.head.appendChild(script)
  })
  return pickerPromise
}

function openPicker(token: string, configure: (picker: any) => { view: any; multiselect: boolean; title: string }) {
  return loadPicker().then(
    (picker) =>
      new Promise<PickedDoc[]>((resolve) => {
        const { view, multiselect, title } = configure(picker)
        const builder = new picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(token)
          .setDeveloperKey(googleApiKey)
          .setAppId(googleAppId)
          .setTitle(title)
          .setCallback((data: any) => {
            if (data.action === picker.Action.PICKED) resolve(data.docs as PickedDoc[])
            else if (data.action === picker.Action.CANCEL) resolve([])
          })
        if (multiselect) builder.enableFeature(picker.Feature.MULTISELECT_ENABLED)
        builder.build().setVisible(true)
      }),
  )
}

// Step 1: the coach picks the shared FlipTurn folder.
export async function pickTeamFolder(token: string): Promise<PickedDoc | null> {
  const docs = await openPicker(token, (picker) => ({
    title: 'Choose the FlipTurn folder shared with you',
    multiselect: false,
    view: new picker.DocsView(picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true)
      .setMimeTypes(FOLDER_MIME)
      .setOwnedByMe(false),
  }))
  return docs[0] ?? null
}

// Step 2, only if Google didn't grant the folder's contents with the folder:
// the coach selects every file inside it.
export async function pickTeamFiles(token: string, folderId: string): Promise<PickedDoc[]> {
  return openPicker(token, (picker) => ({
    title: 'Select all the files in the FlipTurn folder',
    multiselect: true,
    view: new picker.DocsView(picker.ViewId.DOCS).setParent(folderId).setMimeTypes('application/json'),
  }))
}
/* eslint-enable @typescript-eslint/no-explicit-any */
