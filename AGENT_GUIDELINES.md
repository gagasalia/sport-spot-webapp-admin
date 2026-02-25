# Claude Agent Guidelines (Angular + Tailwind + Taiga UI + Signals)

## Purpose

This document defines rules and quality gates for a Claude-based agent that writes production-ready Angular code using:

- Angular (modern versions)
- Tailwind CSS (no SCSS generation)
- Taiga UI
- Signals (Angular signals + interoperable RxJS where needed)

Primary goals: optimized code, no memory leaks, and consistent UI markup.

---

## Non-Negotiables

### Styling

- Use Tailwind utility classes in templates
- Do not generate or suggest `.scss` / `.css` component files
- Use Tailwind or inline bindings when necessary

### UI Library

- Prefer Taiga UI components
- Use Taiga patterns and icons
- Avoid mixing UI libraries

### State & Reactivity

- Use signals for local state
- Use `computed()` for derived values
- Keep `effect()` minimal and safe
- Bridge RxJS and signals using `toSignal()` / `toObservable()`

### Memory Leak Prevention

- Prefer `async` pipe
- Use `takeUntilDestroyed()` when subscribing
- Clean up listeners and timers
- No unmanaged subscriptions

### Performance

- Use `OnPush`
- Use `track` / `trackBy`
- Avoid heavy template logic
- Use signals instead of recalculations

---

## Angular Standards

### Components

- Standalone components only
- Use `inject()` instead of constructor DI

### Imports

- Angular signals APIs
- `DestroyRef`
- `takeUntilDestroyed`
- Taiga modules

---

## Signals Rules

### Use signals for

- UI state (loading, toggles, selections)
- Derived state (`computed`)

### Use RxJS for

- API streams
- Complex async flows

---

## Memory Leak Checklist

Before finishing any solution:

1. Subscriptions are cleaned (async pipe or `takeUntilDestroyed`)
2. Effects are minimal and do not create loops
3. Timers are cleared
4. Event listeners are removed
5. External callbacks are cleaned up

---

## Taiga UI Usage

- Prefer Taiga inputs, dialogs, notifications, dropdowns
- Use `TuiDialogService` with proper teardown
- Avoid custom implementations if Taiga provides a solution

---

## Output Requirements

### Code

- Provide complete, runnable snippets
- No SCSS files
- Use Tailwind in templates

### Reviews

- Explicitly identify memory leaks
- Provide fixed version of the code

---

## Preferred Response Structure

### Solution

- Brief explanation
- Key technical decisions

### Code

```ts
// Angular code
```

```html
<!-- Tailwind + Taiga UI template -->
```

### Notes

- Performance considerations
- Memory safety

---

## Quick Snippets

### Safe subscription

```ts
import { DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

const destroyRef = inject(DestroyRef);
stream$.pipe(takeUntilDestroyed(destroyRef)).subscribe();
```

### RxJS to Signal

```ts
import { toSignal } from '@angular/core/rxjs-interop';

readonly data = toSignal(this.api.getData(), { initialValue: [] });
```

### Loop with tracking

```html
@for (item of items(); track item.id) {
<div class="p-2">{{ item.name }}</div>
}
```

---

## Agent Behavior

- Prefer pragmatic, production-ready solutions
- Follow user constraints strictly
- Never suggest SCSS
- Always check for memory leaks when relevant
