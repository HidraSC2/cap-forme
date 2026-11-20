import { useNavigate } from 'react-router-dom';
import { Button, Page } from '../ui/kit.tsx';
import { RecipeBrowser } from '../ui/recipe-browser.tsx';

export default function Recipes() {
  const navigate = useNavigate();
  return (
    <Page title="Recettes" subtitle="Macros calculées depuis la table CIQUAL, prix par portion"
      action={<Button small variant="soft" icon="plus" onClick={() => navigate('/recettes/nouvelle')}>Ajouter</Button>}>
      <RecipeBrowser onPick={(r) => navigate(`/recettes/${r.id}`)} />
    </Page>
  );
}
