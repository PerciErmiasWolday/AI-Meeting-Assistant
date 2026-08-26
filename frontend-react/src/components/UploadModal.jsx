import { useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import Modal from "./Modal";
import { uploadMeeting } from "../lib/api";
import { toast } from "../lib/toast";

const ALLOWED_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".mp4"];

export default function UploadModal({ open, onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function reset() {
    setFile(null);
    setTitle("");
    setError(null);
    setUploading(false);
  }

  function handleClose() {
    if (uploading) return; // don't let them close mid-upload and lose track of it
    reset();
    onClose();
  }

  function validateAndSetFile(f) {
    if (!f) return;
    const ext = "." + f.name.split(".").pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setError(`Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }
    setError(null);
    setFile(f);
  }

  function handleUpload() {
    if (!file) return;
    setUploading(true);
    setError(null);
    uploadMeeting(file, title)
      .then((meeting) => {
        toast("Meeting uploaded and processed.");
        reset();
        onClose();
        onUploaded?.(meeting);
      })
      .catch((err) => {
        setError(err.message);
        setUploading(false);
      });
  }

  return (
    <Modal open={open} onClose={handleClose} title="Upload Recording">
      {uploading ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
          <p className="text-sm text-[var(--color-text)]">Transcribing and summarizing...</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            This can take a minute or two depending on the recording length. Don't close this window.
          </p>
        </div>
      ) : (
        <>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              validateAndSetFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            className={`flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
              dragOver ? "border-[var(--color-primary)] bg-[var(--color-accent)]/40" : "border-[var(--color-border)] hover:bg-[var(--color-accent)]/20"
            }`}
          >
            <UploadCloud className="h-6 w-6 text-[var(--color-text-muted)]" />
            {file ? (
              <p className="text-sm font-medium text-[var(--color-text)]">{file.name}</p>
            ) : (
              <>
                <p className="text-sm text-[var(--color-text)]">Click to choose a file, or drag one here</p>
                <p className="text-xs text-[var(--color-text-muted)]">{ALLOWED_EXTENSIONS.join(", ")}</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(",")}
              onChange={(e) => validateAndSetFile(e.target.files?.[0])}
              className="hidden"
            />
          </div>

          <label className="mt-3 block text-xs text-[var(--color-text-muted)]">
            Title (optional)
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekly sync with Acme Corp"
              className="mt-1 w-full rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm text-[var(--color-text)] focus:outline-none"
            />
          </label>

          {error && <p className="mt-2 text-sm text-[var(--color-status-red-text)]">{error}</p>}

          <button
            onClick={handleUpload}
            disabled={!file}
            className="mt-4 flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-2.5 text-sm font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <UploadCloud className="h-4 w-4" />
            Upload & Process
          </button>
        </>
      )}
    </Modal>
  );
}
