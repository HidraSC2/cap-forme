import { describe, expect, it } from 'vitest';
import { INGREDIENTS } from '../src/data/ingredients.ts';
import { parseLine } from '../src/lib/parse-ingredient.ts';

const p = (raw: string) => { const r = parseLine(raw, INGREDIENTS); return [r.match?.id ?? null, r.qty.n, r.qty.unit]; };

describe('lecture des lignes d\'ingrédients', () => {
  it('reconnaît quantités, unités et ingrédients', () => {
    expect(p('200 g de pâtes')).toEqual(['pates', 200, 'g']);
    expect(p('1,5 kg de pommes de terre')).toEqual(['pomme-de-terre', 1500, 'g']);
    expect(p('2 c. à soupe d\'huile d\'olive')).toEqual(['huile-olive', 2, 'cs']);
    expect(p('1 cuillère à café de curry')).toEqual(['curry', 1, 'cc']);
    expect(p('3 œufs')).toEqual(['oeuf', 3, 'pc']);
    expect(p('2 gousses d\'ail')).toEqual(['ail', 2, 'pc']);
    expect(p('20 cl de crème fraîche')).toEqual(['creme-legere', 200, 'ml']);
    expect(p('1/2 citron')).toEqual(['citron', 0.5, 'pc']);
    expect(p('1 oignon rouge émincé')).toEqual(['oignon-rouge', 1, 'pc']);
    expect(p('400g de steak haché')).toEqual(['boeuf-hache', 400, 'g']);
    expect(p('150 g de fromage blanc')).toEqual(['fromage-blanc', 150, 'g']);
    expect(p('1 boîte de tomates pelées')).toEqual(['tomate-concassee', 1, 'pc']);
    expect(p('250 g de spaghettis')).toEqual(['pates', 250, 'g']);
    expect(p('1 pomme')).toEqual(['pomme', 1, 'pc']);
  });
  it('laisse de côté ce qu\'elle ne connaît pas', () => {
    expect(p('sel, poivre')[0]).toBeNull();
    expect(p('1 bouquet garni')[0]).toBeNull();
    expect(p('2 feuilles de laurier')[0]).toBeNull();
  });
});
