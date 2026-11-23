import {useState} from 'react';
import {Button} from '@astryxdesign/core/Button';
import {Text} from '@astryxdesign/core/Text';
import {Heading} from '@astryxdesign/core/Heading';
import {VStack, HStack} from '@astryxdesign/core/Stack';
import {FileInput} from '@astryxdesign/core/FileInput';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {TextInput} from '@astryxdesign/core/TextInput';
import {Banner} from '@astryxdesign/core/Banner';
import {photoBatch, pdfBatch, initUnlock, FREE_FILES, MARK, PAYMENT_LINK, UNLOCK_TOKEN} from './engine.js';

const unlockedAtLoad = initUnlock();
const save = (blob, name) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
const Choice = ({value, set, options}) => (
  <HStack gap={2} wrap="wrap">{options.map(([id, label]) => <Button key={id} label={label} size="sm" variant={value === id ? 'primary' : 'secondary'} onClick={() => set(id)} />)}</HStack>
);

export default function App() {
  const unlocked = unlockedAtLoad;
  const [mode, setMode] = useState('photo');
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');
  const [size, setSize] = useState(1200);
  const [square, setSquare] = useState('fit');
  const [quality, setQuality] = useState(82);
  const [mark, setMark] = useState('');
  const [action, setAction] = useState('merge');

  const onFiles = (v) => setFiles(v ? [].concat(v) : []);
  const switchMode = (m) => { setMode(m); setFiles([]); setLog(''); if (m === 'pdf' && quality > 95) setQuality(60); };
  const run = async () => {
    let list = files;
    if (!unlocked && list.length > FREE_FILES) { list = list.slice(0, FREE_FILES); }
    setBusy(true); setLog('Working…');
    try {
      const o = {unlocked, mark: mark.trim(), quality, size, square: square === 'square', action};
      const r = mode === 'photo' ? await photoBatch(list, o, setLog) : await pdfBatch(list, o, setLog);
      save(r.blob, r.name);
      setLog(r.msg + (list.length < files.length ? ` Free batch is ${FREE_FILES} files, so the first ${FREE_FILES} were used.` : ''));
    } catch (e) { setLog('Failed: ' + (e && e.message || e)); }
    setBusy(false);
  };

  return (
    <main style={{maxWidth: 760, margin: '0 auto', padding: '24px 16px 64px'}}>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={1}>Local Studio</Heading>
          <Text color="secondary">Photos and PDFs, processed in your browser. Nothing is uploaded.</Text>
        </VStack>
        <Choice value={mode} set={switchMode} options={[['photo', 'Photos'], ['pdf', 'PDF']]} />
        <FileInput key={mode} label={mode === 'photo' ? 'Photos' : 'PDF files'} isLabelHidden isMultiple mode="dropzone"
          accept={mode === 'photo' ? 'image/*' : 'application/pdf'} value={files} onChange={onFiles} />
        {mode === 'photo' ? (
          <VStack gap={3}>
            <NumberInput label="Size in pixels (longest side, or the square)" value={size} onChange={(v) => v && setSize(v)} />
            <Choice value={square} set={setSquare} options={[['fit', 'Keep proportions'], ['square', 'Square crop']]} />
            <NumberInput label="JPEG quality, %" value={quality} onChange={(v) => v && setQuality(Math.min(100, Math.max(30, v)))} />
          </VStack>
        ) : (
          <VStack gap={3}>
            <Choice value={action} set={setAction} options={[['merge', 'Merge into one'], ['shrink', 'Shrink'], ['mark', 'Watermark only']]} />
            {action === 'shrink' && <NumberInput label="Shrink quality, %" value={quality} onChange={(v) => v && setQuality(Math.min(95, Math.max(20, v)))} />}
          </VStack>
        )}
        <TextInput label="Watermark text (optional)" value={mark} onChange={setMark} />
        <Button label={busy ? 'Working…' : 'Process'} variant="primary" size="lg" isDisabled={busy || !files.length} onClick={run} />
        {log && <Text color="secondary">{log}</Text>}
        {unlocked
          ? <Banner type="success" description={<>Unlocked: no limits and no mark. To unlock another browser or device, <a href={`${location.origin}${location.pathname}?unlocked=${UNLOCK_TOKEN}`}>bookmark this link</a>.</>} />
          : <Banner type="info" description={<>Free: {FREE_FILES} files per batch and a small "{MARK}" mark. <a href={PAYMENT_LINK}>Unlock for good</a>: one payment, no account.</>} />}
      </VStack>
    </main>
  );
}
