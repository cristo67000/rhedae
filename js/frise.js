'use strict';
/*
 * La chronologie : de la cité wisigothique au tourisme d'aujourd'hui.
 *
 * Les dates sont rangées par époques (build/chronologie.txt). Chacune porte sa
 * valeur, et c'est le cœur de l'affaire : « attestée » par un document
 * d'époque, « discutée », « légendaire » quand rien ne l'appuie qu'un récit
 * tardif, « fabriquée » quand il s'agit d'un faux. Quatre pastilles filtrent
 * la frise : ne garder que l'attesté, c'est lire l'histoire ; n'y ajouter que
 * le fabriqué, c'est voir la mystification se monter pièce à pièce.
 */
(function (racine) {

  const { element, bouton } = Outils;
  const NATURES = ['atteste', 'discute', 'legende', 'fabrique'];
  const NOMS = { atteste: 'Attesté', discute: 'Discuté', legende: 'Légende', fabrique: 'Fabriqué' };
  let actives = new Set(NATURES);
  let pret = false;

  function dessinerNatures() {
    const zone = document.getElementById('frise-natures');
    zone.textContent = '';
    for (const n of NATURES) {
      const total = Dossier.epoques.reduce((s, e) => s + e.ev.filter((ev) => ev.n === n).length, 0);
      const f = bouton('filtre filtre-nature nature-' + n + (actives.has(n) ? ' actif' : ''), null, () => {
        if (actives.has(n) && actives.size > 1) actives.delete(n);
        else actives.add(n);
        dessinerNatures();
        dessinerFrise();
      });
      f.setAttribute('aria-pressed', actives.has(n) ? 'true' : 'false');
      f.title = Rendu.EXPLICATIONS[n];
      f.appendChild(element('span', 'point-nature'));
      f.appendChild(document.createTextNode(NOMS[n] + ' '));
      f.appendChild(element('span', 'nombre-filtre', String(total)));
      zone.appendChild(f);
    }
  }

  function dessinerEpoques() {
    const zone = document.getElementById('frise-epoques');
    zone.textContent = '';
    for (const e of Dossier.epoques) {
      zone.appendChild(bouton('epoque', e.nom, () => {
        const cible = document.getElementById('epoque-' + e.id);
        if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }));
    }
  }

  function dessinerFrise() {
    const zone = document.getElementById('frise-contenu');
    zone.textContent = '';
    let total = 0;
    for (const e of Dossier.epoques) {
      const dates = e.ev.filter((ev) => actives.has(ev.n));
      const section = element('section', 'epoque-section');
      section.id = 'epoque-' + e.id;
      section.appendChild(element('h3', 'epoque-titre', e.nom));
      section.appendChild(element('p', 'epoque-def', e.def));
      if (!dates.length) {
        section.appendChild(element('p', 'discret', 'Aucune date de cette valeur à cette époque.'));
      } else {
        const ol = element('ol', 'frise');
        let anPrecedent = null;
        for (const ev of dates) {
          const li = element('li', 'frise-point nature-' + ev.n);
          const date = element('span', 'frise-date' + (ev.a === anPrecedent ? ' meme-annee' : ''), ev.d);
          li.appendChild(date);
          const corps = element('div', 'frise-corps');
          corps.appendChild(Rendu.paragraphe(ev.t, 'frise-fait'));
          if (ev.n !== 'atteste') corps.appendChild(Rendu.pastilleStatut(ev.n, 'petit'));
          li.appendChild(corps);
          ol.appendChild(li);
          anPrecedent = ev.a;
          total += 1;
        }
        section.appendChild(ol);
      }
      zone.appendChild(section);
    }
    const compte = element('p', 'discret compte-frise', Outils.pluriel(total, 'date', 'dates') + (actives.size < NATURES.length ? ' retenues' : ''));
    zone.insertBefore(compte, zone.firstChild);
  }

  function montrer() {
    if (pret) return;
    pret = true;
    dessinerNatures();
    dessinerEpoques();
    dessinerFrise();
  }

  racine.Frise = { montrer, brancher() {} };

})(window);
