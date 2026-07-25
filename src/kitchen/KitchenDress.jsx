import { useEffect, useMemo, useState } from 'react';
import {
  BOOT_STYLES,
  CHARACTER_IDS,
  CHEF_LOOK_PRESETS,
  COSMETIC_SHOP,
  INITIAL_LETTERS,
  SHIRT_STYLES,
  characterLabel,
  bootStyleLabel,
  colorToCss,
  cssToColor,
  normalizeChefLook,
  shirtShowsInitial,
  shirtStyleLabel,
  shopItemForBoot,
  shopItemForCharacter,
  shopItemForShirt,
  APRON_SWATCHES,
  HAT_SWATCHES,
  SHIRT_SWATCHES,
  SKIN_SWATCHES,
  SHOE_SWATCHES,
  characterUsesHat
} from './game/cosmetics/chefLook';
import { buyItem, isOwned, ownsStyle, setLook } from './kitchenProgress.js';
import { ChefPreview } from './ChefPreview.jsx';

function Swatches({ colors, value, onChange, label }) {
  return (
    <div className="rsc-swatch-row">
      <span className="rsc-swatch-label">{label}</span>
      <div className="rsc-swatches">
        {colors.map(c => (
          <button
            key={c}
            type="button"
            className={'rsc-swatch' + (value === c ? ' on' : '')}
            style={{ background: colorToCss(c) }}
            onClick={() => onChange(c)}
            aria-label={colorToCss(c)}
          />
        ))}
      </div>
    </div>
  );
}

function looksEqual(a, b) {
  const A = normalizeChefLook(a);
  const B = normalizeChefLook(b);
  return JSON.stringify(A) === JSON.stringify(B);
}

function previewOwned(progress, preview) {
  return (
    ownsStyle(progress, 'character', preview.characterId) &&
    ownsStyle(progress, 'shirt', preview.shirtStyle) &&
    ownsStyle(progress, 'boots', preview.bootStyle)
  );
}

function missingPurchases(progress, preview) {
  const need = [];
  if (!ownsStyle(progress, 'character', preview.characterId)) {
    const item = shopItemForCharacter(preview.characterId);
    if (item) need.push(item);
  }
  if (!ownsStyle(progress, 'shirt', preview.shirtStyle)) {
    const item = shopItemForShirt(preview.shirtStyle);
    if (item) need.push(item);
  }
  if (!ownsStyle(progress, 'boots', preview.bootStyle)) {
    const item = shopItemForBoot(preview.bootStyle);
    if (item) need.push(item);
  }
  return need;
}

/** Character picker + cosmetic store — try-on preview, then Equip / Buy. */
export function KitchenDress({ progress, onProgress, tab }) {
  const equipped = progress.look;
  const [preview, setPreview] = useState(() => normalizeChefLook(equipped));
  const [flash, setFlash] = useState('');

  useEffect(() => {
    setPreview(normalizeChefLook(progress.look));
  }, [progress.look]);

  const tryOn = partial => {
    setPreview(p => normalizeChefLook({ ...p, ...partial }));
    setFlash('');
  };

  const owned = previewOwned(progress, preview);
  const missing = useMemo(() => missingPurchases(progress, preview), [progress, preview]);
  const buyCost = missing.reduce((s, i) => s + i.priceCoins, 0);
  const canAfford = progress.coins >= buyCost;
  const isEquipped = looksEqual(preview, equipped);

  const doEquip = (fromProgress = progress) => {
    if (!previewOwned(fromProgress, preview)) {
      setFlash('Buy locked pieces before you equip.');
      return;
    }
    onProgress(setLook(fromProgress, preview));
    setFlash('Equipped!');
  };

  const doBuyThenEquip = () => {
    let cur = progress;
    for (const item of missing) {
      const res = buyItem(cur, item.id);
      if (!res.ok) {
        setFlash(res.reason === 'broke' ? 'Not enough coins.' : 'Could not buy.');
        return;
      }
      cur = res.progress;
    }
    onProgress(setLook(cur, preview));
    setFlash(missing.length ? 'Bought & equipped!' : 'Equipped!');
  };

  const purchaseOnly = itemId => {
    const res = buyItem(progress, itemId);
    if (res.ok) {
      onProgress(res.progress);
      setFlash(`Bought ${res.item.name}!`);
    } else {
      setFlash(res.reason === 'broke' ? 'Not enough coins.' : 'Already owned.');
    }
  };

  if (tab === 'character') {
    return (
      <div className="rsc-dress">
        <header className="rsc-dress-head">
          <h3>Choose your cook</h3>
          <p>Tap anything to try it on the preview. Equip when you like it — buy first if it&apos;s locked.</p>
        </header>

        <div className="rsc-dress-layout">
          <aside className="rsc-preview-pane">
            <ChefPreview
              look={preview}
              label={characterLabel(preview.characterId) + (isEquipped ? ' · equipped' : ' · trying on')}
            />
            <div className="rsc-preview-actions">
              {isEquipped ? (
                <button type="button" className="btn small" disabled>Equipped</button>
              ) : owned ? (
                <button type="button" className="btn small primary" onClick={() => doEquip()}>
                  Equip
                </button>
              ) : (
                <button
                  type="button"
                  className="btn small primary"
                  disabled={!canAfford || !missing.length}
                  onClick={doBuyThenEquip}
                >
                  {canAfford ? `Buy (${buyCost}) & Equip` : `Need ${buyCost} coins`}
                </button>
              )}
              {!isEquipped && (
                <button
                  type="button"
                  className="btn small ghost"
                  onClick={() => { setPreview(normalizeChefLook(equipped)); setFlash(''); }}
                >
                  Reset preview
                </button>
              )}
            </div>
            {flash ? <p className="rsc-preview-flash">{flash}</p> : null}
            {!owned && missing.length > 0 && (
              <ul className="rsc-preview-need">
                {missing.map(i => (
                  <li key={i.id}>{i.name} — {i.priceCoins} coins</li>
                ))}
              </ul>
            )}
          </aside>

          <div className="rsc-dress-controls">
            <div className="rsc-dress-panel rsc-theme-panel">
              <h4>
                <span className="rsc-theme-icon" aria-hidden>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                  </svg>
                </span>
                Themes
              </h4>
              <p className="rsc-theme-lead">One-tap color looks — then tweak outfit &amp; swatches below.</p>
              <div className="rsc-theme-grid">
                {CHEF_LOOK_PRESETS.map(preset => {
                  const active =
                    preview.hatColor === preset.look.hatColor &&
                    preview.shirtColor === preset.look.shirtColor &&
                    preview.apronColor === preset.look.apronColor &&
                    preview.hatStyle === preset.look.hatStyle &&
                    preview.shoeColor === preset.look.shoeColor;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      className={'rsc-theme-card' + (active ? ' on' : '')}
                      onClick={() => tryOn({
                        ...preset.look,
                        // Keep the cook you already picked; only apply the theme colors/styles.
                        characterId: preview.characterId,
                        shirtInitial: preview.shirtInitial || preset.look.shirtInitial
                      })}
                      title={preset.name}
                    >
                      <span className="rsc-theme-swatch" aria-hidden>
                        <span style={{ background: colorToCss(preset.look.hatColor) }} />
                        <span style={{ background: colorToCss(preset.look.shirtColor) }} />
                        <span style={{ background: colorToCss(preset.look.apronColor) }} />
                      </span>
                      <span className="rsc-theme-name">{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <h4>Character</h4>
            <div className="rsc-char-grid">
              {CHARACTER_IDS.map(id => {
                const has = ownsStyle(progress, 'character', id);
                const item = shopItemForCharacter(id);
                const active = preview.characterId === id;
                const worn = equipped.characterId === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={
                      'rsc-char-card'
                      + (active ? ' on' : '')
                      + (!has ? ' locked' : '')
                      + (worn ? ' worn' : '')
                    }
                    onClick={() => tryOn({ characterId: id })}
                  >
                    <span className="rsc-char-emoji" aria-hidden>
                      {id === 'chef' ? '👨‍🍳' : id === 'girl' ? '👩‍🍳' : id === 'kid' ? '🧒' : '🧑‍🍳'}
                    </span>
                    <span className="rsc-char-name">{characterLabel(id)}</span>
                    <span className="rsc-char-meta">
                      {!has && item ? `Try · ${item.priceCoins}` : worn ? 'Equipped' : has ? 'Owned' : 'Free'}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rsc-dress-panel">
              <h4>Outfit — tap to try on</h4>
              {characterUsesHat(preview.characterId) && (
                <div className="rsc-style-row">
                  <button
                    type="button"
                    className={'rsc-chip' + (preview.hatStyle === 'floppy' ? ' on' : '')}
                    onClick={() => tryOn({ hatStyle: 'floppy' })}
                  >
                    Floppy hat
                  </button>
                  <button
                    type="button"
                    className={'rsc-chip' + (preview.hatStyle === 'toque' ? ' on' : '')}
                    onClick={() => tryOn({ hatStyle: 'toque' })}
                  >
                    Toque
                  </button>
                </div>
              )}
              <div className="rsc-style-row">
                {SHIRT_STYLES.map(style => {
                  const has = ownsStyle(progress, 'shirt', style);
                  const item = shopItemForShirt(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      className={
                        'rsc-chip'
                        + (preview.shirtStyle === style ? ' on' : '')
                        + (!has ? ' locked' : '')
                      }
                      onClick={() => tryOn({ shirtStyle: style })}
                      title={!has && item ? `Try on · ${item.priceCoins} coins to own` : shirtStyleLabel(style)}
                    >
                      {shirtStyleLabel(style)}
                      {!has && item ? ` · ${item.priceCoins}` : ''}
                    </button>
                  );
                })}
              </div>
              {shirtShowsInitial(preview.shirtStyle) && (
                <label className="rsc-initial">
                  Initial
                  <select
                    value={preview.shirtInitial}
                    onChange={e => tryOn({ shirtInitial: e.target.value })}
                  >
                    {INITIAL_LETTERS.map(L => (
                      <option key={L} value={L}>{L}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="rsc-style-row">
                {BOOT_STYLES.map(style => {
                  const has = ownsStyle(progress, 'boots', style);
                  const item = shopItemForBoot(style);
                  return (
                    <button
                      key={style}
                      type="button"
                      className={
                        'rsc-chip'
                        + (preview.bootStyle === style ? ' on' : '')
                        + (!has ? ' locked' : '')
                      }
                      onClick={() => tryOn({ bootStyle: style })}
                    >
                      {bootStyleLabel(style)}
                      {!has && item ? ` · ${item.priceCoins}` : ''}
                    </button>
                  );
                })}
              </div>
              <Swatches
                label={characterUsesHat(preview.characterId) ? 'Hat' : 'Hair'}
                colors={HAT_SWATCHES}
                value={preview.hatColor}
                onChange={c => tryOn({ hatColor: c })}
              />
              <Swatches
                label="Shirt"
                colors={SHIRT_SWATCHES}
                value={preview.shirtColor}
                onChange={c => tryOn({ shirtColor: c })}
              />
              <Swatches
                label="Apron"
                colors={APRON_SWATCHES}
                value={preview.apronColor}
                onChange={c => tryOn({ apronColor: c })}
              />
              <Swatches
                label="Skin"
                colors={SKIN_SWATCHES}
                value={preview.skinColor}
                onChange={c => tryOn({ skinColor: c })}
              />
              <Swatches
                label="Shoes"
                colors={SHOE_SWATCHES}
                value={preview.shoeColor}
                onChange={c => tryOn({ shoeColor: c })}
              />
              <div className="rsc-hex-row">
                <label className="rsc-hex">
                  {characterUsesHat(preview.characterId) ? 'Hat' : 'Hair'}
                  <input
                    type="color"
                    value={colorToCss(preview.hatColor)}
                    onChange={e => tryOn({ hatColor: cssToColor(e.target.value) })}
                  />
                </label>
                <label className="rsc-hex">
                  Shirt
                  <input
                    type="color"
                    value={colorToCss(preview.shirtColor)}
                    onChange={e => tryOn({ shirtColor: cssToColor(e.target.value) })}
                  />
                </label>
                <label className="rsc-hex">
                  Apron
                  <input
                    type="color"
                    value={colorToCss(preview.apronColor)}
                    onChange={e => tryOn({ apronColor: cssToColor(e.target.value) })}
                  />
                </label>
                <label className="rsc-hex">
                  Skin
                  <input
                    type="color"
                    value={colorToCss(preview.skinColor)}
                    onChange={e => tryOn({ skinColor: cssToColor(e.target.value) })}
                  />
                </label>
                <label className="rsc-hex">
                  Shoes
                  <input
                    type="color"
                    value={colorToCss(preview.shoeColor)}
                    onChange={e => tryOn({ shoeColor: cssToColor(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Store — try on from shop cards too
  return (
    <div className="rsc-dress">
      <header className="rsc-dress-head">
        <h3>Kitchen store</h3>
        <p>Tap an item to try it on the preview, then Buy or Buy &amp; Equip.</p>
      </header>

      <div className="rsc-dress-layout">
        <aside className="rsc-preview-pane">
          <ChefPreview
            look={preview}
            label={characterLabel(preview.characterId) + (isEquipped ? ' · equipped' : ' · trying on')}
          />
          <div className="rsc-preview-actions">
            {isEquipped ? (
              <button type="button" className="btn small" disabled>Equipped</button>
            ) : owned ? (
              <button type="button" className="btn small primary" onClick={() => doEquip()}>
                Equip
              </button>
            ) : (
              <button
                type="button"
                className="btn small primary"
                disabled={!canAfford || !missing.length}
                onClick={doBuyThenEquip}
              >
                {canAfford ? `Buy (${buyCost}) & Equip` : `Need ${buyCost} coins`}
              </button>
            )}
          </div>
          {flash ? <p className="rsc-preview-flash">{flash}</p> : null}
        </aside>

        <div className="rsc-shop-grid">
          {COSMETIC_SHOP.map(item => {
            const has = isOwned(progress, item.id);
            const canBuy = !has && progress.coins >= item.priceCoins;
            const trying =
              (item.characterId && preview.characterId === item.characterId) ||
              (item.shirtStyle && preview.shirtStyle === item.shirtStyle) ||
              (item.bootStyle && preview.bootStyle === item.bootStyle);
            return (
              <div
                key={item.id}
                className={'rsc-shop-card' + (has ? ' owned' : '') + (trying ? ' trying' : '')}
              >
                <button
                  type="button"
                  className="rsc-shop-try"
                  onClick={() => {
                    if (item.characterId) tryOn({ characterId: item.characterId });
                    if (item.shirtStyle) tryOn({ shirtStyle: item.shirtStyle });
                    if (item.bootStyle) tryOn({ bootStyle: item.bootStyle });
                  }}
                >
                  <div className="rsc-shop-top">
                    <strong>{item.name}</strong>
                    <span className="rsc-shop-slot">{item.slot}</span>
                  </div>
                  <p>{item.description}</p>
                  <span className="rsc-shop-try-hint">{trying ? 'On preview' : 'Tap to try on'}</span>
                </button>
                <div className="rsc-shop-buy">
                  <span className="rsc-shop-price">{item.priceCoins} coins</span>
                  {has ? (
                    <button
                      type="button"
                      className="btn small"
                      onClick={() => {
                        if (item.characterId) tryOn({ characterId: item.characterId });
                        if (item.shirtStyle) tryOn({ shirtStyle: item.shirtStyle });
                        if (item.bootStyle) tryOn({ bootStyle: item.bootStyle });
                        // equip this piece into saved look
                        const next = { ...preview };
                        if (item.characterId) next.characterId = item.characterId;
                        if (item.shirtStyle) next.shirtStyle = item.shirtStyle;
                        if (item.bootStyle) next.bootStyle = item.bootStyle;
                        onProgress(setLook(progress, next));
                        setPreview(normalizeChefLook(next));
                        setFlash('Equipped!');
                      }}
                    >
                      Equip
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="btn small ghost"
                        disabled={!canBuy}
                        onClick={() => purchaseOnly(item.id)}
                      >
                        Buy
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        disabled={!canBuy}
                        onClick={() => {
                          if (item.characterId) tryOn({ characterId: item.characterId });
                          if (item.shirtStyle) tryOn({ shirtStyle: item.shirtStyle });
                          if (item.bootStyle) tryOn({ bootStyle: item.bootStyle });
                          const res = buyItem(progress, item.id);
                          if (!res.ok) {
                            setFlash(res.reason === 'broke' ? 'Not enough coins.' : 'Could not buy.');
                            return;
                          }
                          const next = { ...preview };
                          if (item.characterId) next.characterId = item.characterId;
                          if (item.shirtStyle) next.shirtStyle = item.shirtStyle;
                          if (item.bootStyle) next.bootStyle = item.bootStyle;
                          onProgress(setLook(res.progress, next));
                          setPreview(normalizeChefLook(next));
                          setFlash('Bought & equipped!');
                        }}
                      >
                        Buy & Equip
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
