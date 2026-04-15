import './App.scss';
import { ContentInput } from './components/ContentInput';
import { UploadRecords } from './components/UploadRecords';
import { PasswordInput } from './components/PasswordInput';
import { useAtom } from 'jotai';
import { uploadingErrorAtom, uploadingProgressAtom } from './store/uploading';

const App = () => {
  return (
    <div className="app-root">
      <main className="app-shell">
        <section className="workspace-panel">
          <SimpleProgressBar />
          <ContentInput />
        </section>

        <section className="records-panel withScrollbar">
          <UploadRecords />
        </section>
      </main>
      <div className="app-grain" aria-hidden="true" />
      <div className="app-ruler" aria-hidden="true" />
      <div className="app-orb app-orb-top" aria-hidden="true" />
      <div className="app-orb app-orb-bottom" aria-hidden="true" />
      <div className="app-border" aria-hidden="true" />
      <div className="app-fade" aria-hidden="true" />
      <PasswordInput />
    </div>
  );
};

function SimpleProgressBar() {
  const [progress] = useAtom(uploadingProgressAtom);
  const [error] = useAtom(uploadingErrorAtom);

  return (
    <div className="progress-wrap">
      {!!error && <div className="status-error">{error}</div>}
      <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
        <div className="progress-value" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

export default App;
