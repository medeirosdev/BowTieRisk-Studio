import { openUrl } from '@tauri-apps/plugin-opener';
import { strings } from '../../i18n/strings.pt-BR';
import { useDialog } from '../ui/DialogProvider';

const LINKEDIN_URL = 'https://www.linkedin.com/in/guilhermedemedeiros/';

export function AuthorCredit() {
  const { alert } = useDialog();

  function handleClick() {
    void alert(
      <>
        <strong>{strings.author.fullName}</strong>
        <br />
        {strings.author.role}
        <br />
        <br />
        <button type="button" className="link-inline" onClick={() => void openUrl(LINKEDIN_URL)}>
          {strings.author.linkedinLabel}
        </button>
      </>,
    );
  }

  return (
    <span className="author-credit">
      {strings.author.createdBy}{' '}
      <button type="button" className="link-inline" onClick={handleClick}>
        {strings.author.name}
      </button>
    </span>
  );
}
