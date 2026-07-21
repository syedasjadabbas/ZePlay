# ZePlay — Design System Specification (Frozen v1.0)

> **Status**: Frozen (UI Approved for Sprint 2/Round 4)
> **Scope**: All authentication, navigation, catalog, and dashboard interfaces.

---

## 1. Color Palette

### Base & Backgrounds
* **Brand Background (`bg-brand-background`)**: `#060B18` (Deep space black-blue)
* **Surface Panel (`bg-brand-surface`)**: `#0B1535` (Dark navy glass base)
* **Card Container (`bg-brand-cards`)**: `#101C40` (Elevated navy surface)

### Accents & Gradients
* **Primary Accent (`brand-accent`)**: `#3B82F6` (Electric Blue)
* **Primary Button Gradient**: `linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)`
* **Card Surface Gradient**: `linear-gradient(135deg, rgba(11,21,53,0.92) 0%, rgba(7,14,38,0.96) 100%)`
* **Glow Accent**: `0 0 30px rgba(59, 130, 246, 0.25)`

### Typography & Neutrals
* **Primary Text**: `#FFFFFF`
* **Muted Text (`brand-textMuted`)**: `#8895B3`
* **Subtle Borders**: `rgba(255, 255, 255, 0.07)`
* **Active Input Borders**: `rgba(59, 130, 246, 0.5)` with `0 0 0 3px rgba(59,130,246,0.1)`

---

## 2. Glassmorphism Standard
All overlay panels, auth cards, and modal dialogs MUST use:
```css
background: linear-gradient(135deg, rgba(11,21,53,0.92) 0%, rgba(7,14,38,0.96) 100%);
border: 1px solid rgba(255, 255, 255, 0.07);
backdrop-filter: blur(24px);
-webkit-backdrop-filter: blur(24px);
box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.06);
```

---

## 3. Form Input Standards
* **Input Fields**: `bg-[rgba(16,28,64,0.8)]`, rounded-xl (`12px`), padding `16px 12px`.
* **Placeholders**: `placeholder:text-white/30`, clear descriptive prompt text (e.g. `Enter your email address`, no fake names like `John Doe`).
* **Focus States**: Smooth `200ms` transition to `border: 1px solid rgba(59,130,246,0.5)` and `box-shadow: 0 0 0 3px rgba(59,130,246,0.1)`.

---

## 4. Button & Hover Specifications
* **Primary Button**: `rounded-xl`, `font-bold`, `text-sm`, `py-3`, `px-6`.
* **Hover State**: `transform: translateY(-1px)`, elevated shadow `0 12px 32px rgba(59,130,246,0.45)`.
* **Secondary / Outline Button**: `background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.08)`. Hover: `background: rgba(255,255,255,0.07)`.

---

## 5. Typography Standards
* **Display Font**: `Outfit`, `sans-serif` (Headings, logo, display numbers)
* **Body Font**: `Inter`, `sans-serif` (Form labels, body text, metadata)
