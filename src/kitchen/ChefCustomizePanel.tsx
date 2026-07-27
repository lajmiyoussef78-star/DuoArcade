import { useMemo, useState } from "react";
import {
  APRON_SWATCHES,
  BOOT_STYLES,
  CHARACTER_IDS,
  CHEF_LOOK_PRESETS,
  COSMETIC_SHOP,
  HAT_SWATCHES,
  INITIAL_LETTERS,
  SHIRT_STYLES,
  SHIRT_SWATCHES,
  SHOE_SWATCHES,
  SKIN_SWATCHES,
  bootStyleLabel,
  characterLabel,
  characterUsesHat,
  colorToCss,
  shirtShowsInitial,
  shirtStyleLabel,
  type BootStyle,
  type CharacterId,
  type ChefLook,
  type CosmeticShopItem,
  type HatStyle,
  type ShirtStyle,
} from "./game/cosmetics/chefLook";
import { useGamePrefs } from "./gamePrefs";
import { useKitchenProgress } from "./kitchenProgressStore";
import { ChefPreview, hatStyleLabel } from "./ChefPreview";

function SwatchRow({
  label,
  colors,
  value,
  onPick,
}: {
  label: string;
  colors: number[];
  value: number;
  onPick: (c: number) => void;
}) {
  return (
    <div className="chef-swatch-row">
      <span className="chef-swatch-label">{label}</span>
      <div className="chef-swatches">
        {colors.map((c) => {
          const selected = c === value;
          return (
            <button
              key={`${label}-${c}`}
              type="button"
              className={`chef-swatch${selected ? " selected" : ""}`}
              style={{ background: colorToCss(c) }}
              aria-label={`${label} ${colorToCss(c)}`}
              aria-pressed={selected}
              onClick={() => onPick(c)}
            />
          );
        })}
      </div>
    </div>
  );
}

function lookWithShopItem(base: ChefLook, item: CosmeticShopItem): ChefLook {
  return {
    ...base,
    ...(item.shirtStyle ? { shirtStyle: item.shirtStyle } : {}),
    ...(item.bootStyle ? { bootStyle: item.bootStyle } : {}),
    ...(item.characterId ? { characterId: item.characterId } : {}),
  };
}

function shopSlotLabel(slot: CosmeticShopItem["slot"]): string {
  if (slot === "character") return "Character";
  if (slot === "boots") return "Boots";
  return "Clothes";
}

function ShopCard({
  item,
  owned,
  equipped,
  previewing,
  coins,
  tryOnLook,
  onPreview,
  onBuy,
  onEquip,
}: {
  item: CosmeticShopItem;
  owned: boolean;
  equipped: boolean;
  previewing: boolean;
  coins: number;
  tryOnLook: ChefLook;
  onPreview: () => void;
  onBuy: () => void;
  onEquip: () => void;
}) {
  const canAfford = coins >= item.priceCoins;
  return (
    <article
      className={`chef-shop-card${equipped ? " equipped" : ""}${owned ? " owned" : ""}${previewing ? " previewing" : ""}`}
    >
      <button
        type="button"
        className="chef-shop-card-try"
        onClick={onPreview}
        aria-pressed={previewing}
        title={previewing ? "Previewing" : "Try on"}
      >
        <div className="chef-shop-card-preview">
          <ChefPreview look={tryOnLook} size={72} />
        </div>
        <div className="chef-shop-card-top">
          <span className="chef-shop-slot">{shopSlotLabel(item.slot)}</span>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
          <span className="chef-shop-try-hint">{previewing ? "Previewing" : "Tap to try on"}</span>
        </div>
      </button>
      <div className="chef-shop-card-actions">
        {owned ? (
          <button
            type="button"
            className={`rsc-btn${equipped ? "" : " ghost"}`}
            onClick={onEquip}
            disabled={equipped}
          >
            {equipped ? "Equipped" : "Equip"}
          </button>
        ) : (
          <button
            type="button"
            className="rsc-btn"
            disabled={!canAfford}
            onClick={onBuy}
            title={canAfford ? `Buy for ${item.priceCoins} coins` : "Not enough coins"}
          >
            Buy · {item.priceCoins}🪙
          </button>
        )}
      </div>
    </article>
  );
}

export function ChefCustomizePanel({
  onDone,
  compact = false,
}: {
  onDone?: () => void;
  compact?: boolean;
}) {
  const look = useGamePrefs((s) => s.chefLook);
  const setChefLook = useGamePrefs((s) => s.setChefLook);
  const coins = useKitchenProgress((s) => s.coins);
  const buyCosmetic = useKitchenProgress((s) => s.buyCosmetic);
  const ownsCosmetic = useKitchenProgress((s) => s.ownsCosmetic);
  const ownsShirtStyle = useKitchenProgress((s) => s.ownsShirtStyle);
  const ownsBootStyle = useKitchenProgress((s) => s.ownsBootStyle);
  const ownsCharacterId = useKitchenProgress((s) => s.ownsCharacterId);
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);

  const previewItem = useMemo(
    () => (previewItemId ? COSMETIC_SHOP.find((i) => i.id === previewItemId) ?? null : null),
    [previewItemId],
  );

  const displayLook = useMemo(
    () => (previewItem ? lookWithShopItem(look, previewItem) : look),
    [look, previewItem],
  );
  const showInitialPicker = shirtShowsInitial(displayLook.shirtStyle);
  const showHatStyles = characterUsesHat(displayLook.characterId);

  function patch(partial: Partial<ChefLook>, keepPreview = false) {
    if (!keepPreview) setPreviewItemId(null);
    setChefLook(partial);
  }

  function tryEquipCharacter(id: CharacterId) {
    if (!ownsCharacterId(id)) {
      const item = COSMETIC_SHOP.find((i) => i.characterId === id);
      if (item) setPreviewItemId((cur) => (cur === item.id ? null : item.id));
      return;
    }
    patch({ characterId: id });
  }

  function tryEquipShirt(style: ShirtStyle) {
    if (!ownsShirtStyle(style)) {
      const item = COSMETIC_SHOP.find((i) => i.shirtStyle === style);
      if (item) setPreviewItemId((id) => (id === item.id ? null : item.id));
      return;
    }
    patch({ shirtStyle: style });
  }

  function tryEquipBoot(style: BootStyle) {
    if (!ownsBootStyle(style)) {
      const item = COSMETIC_SHOP.find((i) => i.bootStyle === style);
      if (item) setPreviewItemId((id) => (id === item.id ? null : item.id));
      return;
    }
    patch({ bootStyle: style });
  }

  function buyAndEquip(item: CosmeticShopItem) {
    if (!buyCosmetic(item.id)) return;
    setPreviewItemId(null);
    if (item.characterId) setChefLook({ characterId: item.characterId });
    if (item.shirtStyle) setChefLook({ shirtStyle: item.shirtStyle });
    if (item.bootStyle) setChefLook({ bootStyle: item.bootStyle });
  }

  function togglePreview(item: CosmeticShopItem) {
    setPreviewItemId((id) => (id === item.id ? null : item.id));
  }

  const characters = COSMETIC_SHOP.filter((i) => i.slot === "character");
  const shirts = COSMETIC_SHOP.filter((i) => i.slot === "shirt");
  const boots = COSMETIC_SHOP.filter((i) => i.slot === "boots");

  return (
    <div className={`chef-customize${compact ? " compact" : ""}`}>
      <header className="chef-customize-head">
        <p className="embed-kicker">Your cook</p>
        <h2>Character & outfit</h2>
        <p className="chef-customize-lead">
          Unlock girl, man, chef, and more with coins. Then dress them up with clothes and
          boots.
        </p>
        <div className="kitchen-coins-bar" title="Kitchen coins">
          <span className="kitchen-coins-icon" aria-hidden>
            🪙
          </span>
          <span className="kitchen-coins-label">Coins</span>
          <span className="kitchen-coins-value">{coins.toLocaleString()}</span>
        </div>
      </header>

      <div className="chef-customize-body">
        <div className={`chef-customize-preview${previewItem ? " is-previewing" : ""}`}>
          <ChefPreview look={displayLook} size={compact ? 132 : 168} />
          {previewItem && (
            <div className="chef-preview-banner">
              <span>
                Trying on <strong>{previewItem.name}</strong>
              </span>
              <button type="button" className="chef-preview-clear" onClick={() => setPreviewItemId(null)}>
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="chef-customize-controls">
          <div className="chef-hat-styles">
            <span className="chef-swatch-label">Character</span>
            <div className="chef-hat-style-btns">
              {CHARACTER_IDS.map((id) => {
                const owned = ownsCharacterId(id);
                const previewing = !owned && previewItem?.characterId === id;
                const active = owned ? look.characterId === id : previewing;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`rsc-btn${active ? "" : " ghost"}${previewing ? " previewing" : ""}`}
                    title={owned ? characterLabel(id) : "Tap to try on — buy in shop below"}
                    onClick={() => tryEquipCharacter(id)}
                  >
                    {characterLabel(id)}
                    {!owned ? " 🔒" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="chef-presets">
            {CHEF_LOOK_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="chef-preset"
                onClick={() => {
                  const next = { ...p.look, characterId: look.characterId };
                  if (!ownsShirtStyle(next.shirtStyle)) next.shirtStyle = look.shirtStyle;
                  if (!ownsBootStyle(next.bootStyle)) next.bootStyle = look.bootStyle;
                  patch(next);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>

          {showHatStyles && (
            <div className="chef-hat-styles">
              <span className="chef-swatch-label">Hat style</span>
              <div className="chef-hat-style-btns">
                {(["floppy", "toque"] as HatStyle[]).map((style) => (
                  <button
                    key={style}
                    type="button"
                    className={`rsc-btn${look.hatStyle === style ? "" : " ghost"}`}
                    onClick={() => patch({ hatStyle: style })}
                  >
                    {hatStyleLabel(style)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="chef-hat-styles">
            <span className="chef-swatch-label">Clothes</span>
            <div className="chef-hat-style-btns">
              {SHIRT_STYLES.map((style) => {
                const owned = ownsShirtStyle(style);
                const previewing = !owned && previewItem?.shirtStyle === style;
                const active = owned ? look.shirtStyle === style : previewing;
                return (
                  <button
                    key={style}
                    type="button"
                    className={`rsc-btn${active ? "" : " ghost"}${previewing ? " previewing" : ""}`}
                    title={owned ? shirtStyleLabel(style) : "Tap to try on — buy in shop below"}
                    onClick={() => tryEquipShirt(style)}
                  >
                    {shirtStyleLabel(style)}
                    {!owned ? " 🔒" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {showInitialPicker && (
            <div className="chef-initial-picker">
              <span className="chef-swatch-label">Shirt initial</span>
              <p className="chef-initial-lead">Pick the letter that appears on your tee.</p>
              <div className="chef-initial-grid" role="listbox" aria-label="Shirt initial">
                {INITIAL_LETTERS.map((letter) => {
                  const selected = displayLook.shirtInitial === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      className={`chef-initial-btn${selected ? " selected" : ""}`}
                      onClick={() => patch({ shirtInitial: letter }, true)}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="chef-hat-styles">
            <span className="chef-swatch-label">Boots</span>
            <div className="chef-hat-style-btns">
              {BOOT_STYLES.map((style) => {
                const owned = ownsBootStyle(style);
                const previewing = !owned && previewItem?.bootStyle === style;
                const active = owned ? look.bootStyle === style : previewing;
                return (
                  <button
                    key={style}
                    type="button"
                    className={`rsc-btn${active ? "" : " ghost"}${previewing ? " previewing" : ""}`}
                    title={owned ? bootStyleLabel(style) : "Tap to try on — buy in shop below"}
                    onClick={() => tryEquipBoot(style)}
                  >
                    {bootStyleLabel(style)}
                    {!owned ? " 🔒" : ""}
                  </button>
                );
              })}
            </div>
          </div>

          <SwatchRow
            label={showHatStyles ? "Hat" : "Hair"}
            colors={HAT_SWATCHES}
            value={look.hatColor}
            onPick={(hatColor) => patch({ hatColor }, true)}
          />
          <SwatchRow
            label="Shirt"
            colors={SHIRT_SWATCHES}
            value={look.shirtColor}
            onPick={(shirtColor) => patch({ shirtColor }, true)}
          />
          <SwatchRow
            label="Apron"
            colors={APRON_SWATCHES}
            value={look.apronColor}
            onPick={(apronColor) => patch({ apronColor }, true)}
          />
          <SwatchRow
            label="Skin"
            colors={SKIN_SWATCHES}
            value={look.skinColor}
            onPick={(skinColor) => patch({ skinColor }, true)}
          />
          <SwatchRow
            label="Shoes"
            colors={SHOE_SWATCHES}
            value={look.shoeColor}
            onPick={(shoeColor) => patch({ shoeColor }, true)}
          />
        </div>
      </div>

      {/* Full-width shop — uses the whole panel, not just the right column */}
      <div className="chef-shop">
        <h3 className="chef-shop-title">Character & outfit shop</h3>
        <p className="chef-shop-lead">
          Tap to try on, then buy with coins from matches. Chef is free.
        </p>
        <div className="chef-shop-grid">
          {characters.map((item) => (
            <ShopCard
              key={item.id}
              item={item}
              owned={ownsCosmetic(item.id)}
              equipped={look.characterId === item.characterId}
              previewing={previewItemId === item.id}
              coins={coins}
              tryOnLook={lookWithShopItem(look, item)}
              onPreview={() => togglePreview(item)}
              onBuy={() => buyAndEquip(item)}
              onEquip={() => item.characterId && tryEquipCharacter(item.characterId)}
            />
          ))}
          {shirts.map((item) => (
            <ShopCard
              key={item.id}
              item={item}
              owned={ownsCosmetic(item.id)}
              equipped={look.shirtStyle === item.shirtStyle}
              previewing={previewItemId === item.id}
              coins={coins}
              tryOnLook={lookWithShopItem(look, item)}
              onPreview={() => togglePreview(item)}
              onBuy={() => buyAndEquip(item)}
              onEquip={() => item.shirtStyle && tryEquipShirt(item.shirtStyle)}
            />
          ))}
          {boots.map((item) => (
            <ShopCard
              key={item.id}
              item={item}
              owned={ownsCosmetic(item.id)}
              equipped={look.bootStyle === item.bootStyle}
              previewing={previewItemId === item.id}
              coins={coins}
              tryOnLook={lookWithShopItem(look, item)}
              onPreview={() => togglePreview(item)}
              onBuy={() => buyAndEquip(item)}
              onEquip={() => item.bootStyle && tryEquipBoot(item.bootStyle)}
            />
          ))}
        </div>
      </div>

      {onDone && (
        <button type="button" className="rsc-btn chef-done" onClick={onDone}>
          Done — back to maps
        </button>
      )}
    </div>
  );
}
