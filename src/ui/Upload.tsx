import { useRef, useState } from 'react';
import type { InputFile } from '../worker/protocol';

interface Props {
  onFiles: (files: InputFile[]) => void;
  busy: boolean;
  progress: { label: string; frac: number } | null;
  compact?: boolean;
}

async function toInput(files: FileList | File[]): Promise<InputFile[]> {
  const list = [...files].filter((f) => /\.(zip|txt)$/i.test(f.name));
  return Promise.all(list.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() })));
}

/** F1: drop or pick a GG .zip (or several .txt). Files are read locally; nothing is sent anywhere. */
export function Upload({ onFiles, busy, progress, compact }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handle = async (files: FileList | File[] | null) => {
    if (!files || files.length === 0) return;
    const inputs = await toInput(files);
    if (inputs.length) onFiles(inputs);
  };

  return (
    <div
      className={`dropzone${over ? ' over' : ''}${compact ? ' compact' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void handle(e.dataTransfer.files);
      }}
      onClick={() => !busy && input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
    >
      <input
        ref={input}
        type="file"
        accept=".zip,.txt"
        multiple
        hidden
        onChange={(e) => {
          void handle(e.target.files);
          e.target.value = '';
        }}
      />
      {compact ? (
        <span>拖入新的 .zip / .txt，或點此選擇</span>
      ) : (
        <>
          <div className="drop-title">拖入 GG PokerCraft 匯出的 .zip</div>
          <div className="drop-sub">也可以一次拖入多個 .txt。所有解析都在瀏覽器內完成，手牌不會離開這台電腦。</div>
        </>
      )}
      {progress && (
        <div className="progress" aria-label={progress.label}>
          <div className="bar" style={{ width: `${Math.round(progress.frac * 100)}%` }} />
          <span>{progress.label}</span>
        </div>
      )}
    </div>
  );
}
