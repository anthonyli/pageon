// Self-contained factory: the same registry/player is embedded in offline HTML.
// Animate individual translate/scale properties, leaving card positioning intact.
export function createNoteAnimations({ allowCharacters = true } = {}) {
  const registry = new Map();
  const active = new WeakMap();
  const lastPositions = new WeakMap();
  const register = effect => {
    if (!effect || !/^[a-z][a-z0-9-]{0,63}$/.test(effect.id) || registry.has(effect.id) ||
      typeof effect.label?.zh !== 'string' || typeof effect.label?.en !== 'string' ||
      !Array.isArray(effect.keyframes) || !Number.isFinite(effect.duration) || effect.duration < 0) {
      throw new TypeError('invalid-note-animation');
    }
    const value = Object.freeze({ ...effect, label: Object.freeze({ ...effect.label }),
      keyframes: Object.freeze(effect.keyframes.map(frame => Object.freeze({ ...frame }))) });
    registry.set(value.id, value);
  };
  register({ id: 'none', label: { zh: '无动画', en: 'None' }, duration: 0, keyframes: [] });
  register({ id: 'fade', label: { zh: '淡入', en: 'Fade in' }, duration: 220,
    keyframes: [{ opacity: 0 }, { opacity: 1 }] });
  register({ id: 'fly', label: { zh: '飞入', en: 'Fly in' }, duration: 280,
    keyframes: [{ opacity: 0, translate: '0 24px' }, { opacity: 1, translate: '0 0' }] });
  register({ id: 'zoom', label: { zh: '缩放', en: 'Zoom in' }, duration: 240,
    keyframes: [{ opacity: 0, scale: '0.9' }, { opacity: 1, scale: '1' }] });
  if (allowCharacters) register({ id: 'companion', label: { zh: '角色随机入场', en: 'Character entrance' }, duration: 0, keyframes: [] });
  const normalize = id => registry.has(id) ? id : 'none';
  const cancel = element => {
    const animation = active.get(element);
    active.delete(element);
    animation?.cancel();
  };
  const play = (element, id) => {
    cancel(element);
    const effect = registry.get(normalize(id));
    const win = element?.ownerDocument?.defaultView;
    if (!effect.duration || !element?.animate || win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return null;
    let animation;
    try {
      animation = element.animate(effect.keyframes, { duration: effect.duration, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'none' });
    } catch { return null; } // Older engines still show the fully readable card.
    active.set(element, animation);
    const release = () => { if (active.get(element) === animation) active.delete(element); };
    animation.finished?.then(release, release);
    return animation;
  };
  const characters = [
    { id: 'dot', label: { zh: '圆圈', en: 'Circle' } },
    { id: 'blob', label: { zh: '软糖', en: 'Jelly' } },
    { id: 'spark', label: { zh: '小星', en: 'Spark' } },
    { id: 'frog', label: { zh: '小蛙', en: 'Frog' } },
    { id: 'custom', label: { zh: '自己的图片', en: 'My image' } },
  ];
  const normalizeCharacter = raw => {
    let value = raw;
    if (typeof raw === 'string') { try { value = raw.length <= 190000 ? JSON.parse(raw) : null; } catch { value = null; } }
    const id = characters.some(item => item.id === value?.id) ? value.id : 'dot';
    const color = /^#[0-9a-f]{6}$/i.test(value?.color || '') ? value.color : '#4678ff';
    const image = typeof value?.image === 'string' && value.image.length <= 180000 && /^data:image\/(png|webp|jpeg);base64,[a-z0-9+/]+=*$/i.test(value.image) ? value.image : '';
    return { id, color, image };
  };
  const characterImage = raw => {
    const { id, color, image } = normalizeCharacter(raw);
    if (id === 'custom' && image) return image;
    const eyes = '<ellipse cx="38" cy="49" rx="3.4" ry="5" fill="#192536"/><ellipse cx="58" cy="49" rx="3.4" ry="5" fill="#192536"/><circle cx="39" cy="47" r="1" fill="white"/><circle cx="59" cy="47" r="1" fill="white"/>';
    const smile = '<path d="M42 61 Q48 66 54 61" fill="none" stroke="#192536" stroke-width="2.5" stroke-linecap="round"/>';
    const body = id === 'blob'
      ? '<path d="M25 22 Q28 10 40 17 Q50 7 60 19 Q76 15 77 32 Q91 40 80 55 Q87 71 70 75 Q62 91 48 80 Q32 90 25 75 Q8 71 17 55 Q5 39 20 32Z" fill="url(#body)"/><ellipse cx="45" cy="22" rx="25" ry="9" transform="rotate(-18 45 22)" fill="#202b38"/>' + eyes + smile
      : id === 'spark'
      ? '<path d="M36 18 Q48 5 60 18 L82 64 Q90 84 68 84 H28 Q6 84 14 64Z" fill="url(#body)"/>' + eyes + '<g fill="none" stroke="#273344" stroke-width="2.5"><ellipse cx="36" cy="48" rx="12" ry="15"/><ellipse cx="60" cy="48" rx="12" ry="15"/><path d="M48 46 h0"/></g><path d="M33 77 L48 82 L63 77 V90 L48 84 L33 90Z" fill="#273344"/>'
      : id === 'frog'
      ? '<path d="M20 38 Q10 12 32 13 Q46 13 48 30 Q50 13 64 13 Q86 12 76 38 Q92 48 82 70 Q76 85 48 84 Q20 85 14 70 Q4 48 20 38Z" fill="url(#body)"/><g fill="white"><ellipse cx="31" cy="28" rx="10" ry="12"/><ellipse cx="65" cy="28" rx="10" ry="12"/></g><g fill="#192536"><ellipse cx="32" cy="29" rx="5" ry="7"/><ellipse cx="64" cy="29" rx="5" ry="7"/></g>' + smile
      : '<path d="M84 48a36 36 0 1 0-72 0a36 36 0 1 0 72 0M64 48a16 16 0 1 0-32 0a16 16 0 1 0 32 0" fill="url(#body)" fill-rule="evenodd"/>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><radialGradient id="body" cx="30%" cy="22%" r="85%"><stop stop-color="' + color + '"/><stop offset=".65" stop-color="' + color + '"/><stop offset="1" stop-color="' + color + '"/></radialGradient></defs>' + body + '</svg>');
  };
  const readImage = (file, doc) => new Promise((resolve, reject) => {
    if (!file || !['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) { reject(new Error('character-image-type')); return; }
    if (file.size > 2 * 1024 * 1024) { reject(new Error('character-image-size')); return; }
    const win = doc.defaultView, reader = new win.FileReader();
    reader.onerror = () => reject(new Error('character-image-decode'));
    reader.onload = () => {
      const img = new win.Image();
      img.onerror = () => reject(new Error('character-image-decode'));
      img.onload = () => {
        try {
          if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 40000000) throw new Error('character-image-size');
          const ratio = Math.min(1, 256 / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = doc.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio)); canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          let image = canvas.toDataURL('image/png');
          if (image.length > 180000) {
            canvas.width = Math.max(1, Math.round(canvas.width / 2)); canvas.height = Math.max(1, Math.round(canvas.height / 2));
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); image = canvas.toDataURL('image/png');
          }
          if (image.length > 180000) throw new Error('character-image-size');
          resolve(image);
        } catch (error) { reject(error); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
  // All coordinates, including every motion waypoint, are inside the visual viewport.
  const layout = ({ viewport, anchor, destination, bubbleWidth = 300, bubbleHeight = 100 }) => {
    const { width: w, height: h, left = 0, top = 0 } = viewport;
    const margin = Math.min(96, Math.max(24, Math.min(w, h) * .08), w / 8, h / 8);
    const gap = Math.min(12, w / 12, h / 12);
    const size = Math.max(0, Math.min(76, w - 2 * margin, (h - 2 * margin - gap) / 2));
    const horizontal = w >= size + gap + 180 + 2 * margin;
    const bw = Math.max(0, Math.min(bubbleWidth, w - 2 * margin - (horizontal ? size + gap : 0)));
    const bh = Math.max(0, Math.min(bubbleHeight, h - 2 * margin - (horizontal ? 0 : size + gap)));
    const gw = horizontal ? size + gap + bw : Math.max(size, bw), gh = horizontal ? Math.max(size, bh) : size + gap + bh;
    const clamp = (n, a, b) => Math.min(Math.max(n, a), Math.max(a, b));
    const center = destination ? left + w * destination.x : anchor ? (anchor.left + anchor.right) / 2 : left + w / 2;
    const x = destination ? left + margin + Math.max(0, w - 2 * margin - gw) * destination.x
      : clamp(center - gw / 2, left + margin, left + w - margin - gw);
    const y = destination ? top + margin + Math.max(0, h - 2 * margin - gh) * destination.y
      : clamp(anchor ? anchor.bottom + 16 : top + h - margin - gh, top + margin, top + h - margin - gh);
    const bubbleOnLeft = horizontal && center > left + w / 2;
    return {
      actor: { x: x + (horizontal ? (bubbleOnLeft ? bw + gap : 0) : (gw - size) / 2), y: y + (horizontal ? (gh - size) / 2 : bh + gap), size },
      bubble: { x: x + (horizontal && !bubbleOnLeft ? size + gap : 0), y: y + (horizontal ? (gh - bh) / 2 : 0), width: bw, height: bh },
      side: horizontal ? (bubbleOnLeft ? 'left' : 'right') : 'top', margin,
    };
  };
  const present = ({ tip, root, node, character, onSettled }) => {
    const doc = tip.ownerDocument, win = doc.defaultView;
    // Sample at playback time, never when generating or saving the HTML.
    const random = () => win.Math.random();
    const between = (low, high) => low + random() * (high - low);
    const mode = Math.floor(random() * 3), edge = Math.floor(random() * 4);
    const previous = lastPositions.get(doc);
    let destination;
    let stopped = false, settled = false, fallback;
    const motions = [];
    const actor = doc.createElement('div'); actor.className = 'note-character'; actor.setAttribute('aria-hidden', 'true');
    actor.style.cssText = 'position:fixed;pointer-events:none;overflow:hidden;z-index:1;';
    const avatar = doc.createElement('img'); avatar.alt = ''; avatar.src = characterImage(character);
    avatar.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;'; actor.append(avatar); root.append(actor);
    tip.style.cssText = 'visibility:hidden;transform:none;bottom:auto;box-shadow:0 6px 24px #102b2924;border-radius:18px;';
    tip.hidden = false;
    const viewport = () => ({ left: win.visualViewport?.offsetLeft || 0, top: win.visualViewport?.offsetTop || 0,
      width: win.visualViewport?.width || win.innerWidth, height: win.visualViewport?.height || win.innerHeight });
    const position = () => {
      const view = viewport(), anchor = node?.getBoundingClientRect?.();
      const limits = layout({ viewport: view, anchor, bubbleHeight: view.height });
      tip.style.maxWidth = limits.bubble.width + 'px'; tip.style.maxHeight = limits.bubble.height + 'px';
      tip.style.minWidth = '0'; tip.style.padding = Math.min(14, view.height / 12, view.width / 12) + 'px';
      const rect = tip.getBoundingClientRect();
      const place = target => layout({ viewport: view, destination: target, bubbleWidth: rect.width || limits.bubble.width, bubbleHeight: rect.height || 80 });
      if (!destination) {
        const distance = target => {
          const a = place(target).actor;
          return previous ? Math.hypot(a.x + a.size / 2 - view.left - previous.x * view.width,
            a.y + a.size / 2 - view.top - previous.y * view.height) : Infinity;
        };
        const minimum = Math.min(240, Math.min(view.width, view.height) * .28);
        let bestDistance = -1;
        // Try random positions first. Corners of the safe area provide a bounded
        // fallback even when randomness repeats or the available space is tiny.
        const candidates = Array.from({ length: 12 }, () => ({ x: random(), y: random() }));
        candidates.push({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 });
        for (const candidate of candidates) {
          const separation = distance(candidate);
          if (separation > bestDistance) { destination = candidate; bestDistance = separation; }
          if (separation >= minimum) break;
        }
      }
      // Keep this destination through settling, scroll and viewport resizing.
      const placed = place(destination);
      lastPositions.set(doc, { x: (placed.actor.x + placed.actor.size / 2 - view.left) / view.width,
        y: (placed.actor.y + placed.actor.size / 2 - view.top) / view.height });
      actor.style.width = actor.style.height = placed.actor.size + 'px';
      actor.style.left = placed.actor.x + 'px'; actor.style.top = placed.actor.y + 'px';
      tip.style.left = placed.bubble.x + 'px'; tip.style.top = placed.bubble.y + 'px';
      tip.dataset.characterSide = placed.side;
      return { view, ...placed };
    };
    const settle = () => {
      if (stopped || settled) return;
      settled = true; win.clearTimeout(fallback); motions.forEach(motion => motion.cancel());
      position(); tip.style.visibility = ''; onSettled?.();
    };
    const { view, actor: end } = position();
    const margin = Math.min(12, view.width / 12, view.height / 12);
    actor.dataset.motion = ['hop', 'roll', 'glide'][mode];
    const minX = view.left + margin, maxX = Math.max(minX, view.left + view.width - margin - end.size);
    const minY = view.top + margin, maxY = Math.max(minY, view.top + view.height - margin - end.size);
    const clampX = x => Math.max(minX, Math.min(maxX, x));
    const clampY = y => Math.max(minY, Math.min(maxY, y));
    let startX = edge < 2 ? (edge === 0 ? minX : maxX) : between(minX, maxX);
    let startY = edge >= 2 ? (edge === 2 ? minY : maxY) : between(minY, maxY);
    // Avoid an almost invisible entrance when the note is next to that edge.
    if (Math.hypot(startX - end.x, startY - end.y) < Math.min(120, Math.hypot(maxX - minX, maxY - minY) / 3)) {
      if (edge < 2) startX = edge === 0 ? maxX : minX;
      else startY = edge === 2 ? maxY : minY;
    }
    const bendX = clampX((startX + end.x) / 2 + between(-.4, .4) * (maxX - minX));
    const bendY = clampY((startY + end.y) / 2 + between(-.4, .4) * (maxY - minY));
    const hops = 2 + Math.floor(random() * 2), height = between(35, 110);
    const duration = Math.round(between(850, 1250)), direction = random() < .5 ? -1 : 1;
    const rotation = direction * between(240, 440), tilt = direction * between(8, 20);
    const frames = Array.from({ length: 25 }, (_, index) => {
      const t = index / 24, u = 1 - t;
      const x = u * u * startX + 2 * u * t * bendX + t * t * end.x;
      const hop = mode === 0 ? Math.abs(Math.sin(Math.PI * hops * t)) * height * (1 - t) : 0;
      const y = u * u * startY + 2 * u * t * bendY + t * t * end.y - hop;
      // Bounded samples + non-overshooting interpolation keep the whole path inside.
      return { offset: t, transform: `translate(${clampX(x) - end.x}px,${clampY(y) - end.y}px)` };
    });
    const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && actor.animate) {
      try {
        const move = actor.animate(frames, { duration, easing: 'ease-in-out', fill: 'none' }); motions.push(move);
        const pose = mode === 1
          ? [{ transform: `scale(.7) rotate(${rotation}deg)` }, { transform: `scale(.7) rotate(${direction * 30}deg)`, offset: .8 }, { transform: 'scale(1) rotate(0)' }]
          : [{ transform: `scale(.85,.95) rotate(${tilt}deg)` }, { transform: `scale(.95,.78) rotate(${-tilt / 2}deg)`, offset: .78 }, { transform: 'scale(1) rotate(0)' }];
        const poseAnimation = avatar.animate(pose, { duration, easing: 'ease-in-out', fill: 'none' });
        poseAnimation.finished?.catch(() => {}); motions.push(poseAnimation);
        move.finished?.then(settle, () => {});
        fallback = win.setTimeout(settle, duration + 50);
      } catch { settle(); }
    } else settle();
    return {
      reposition() { if (stopped) return; position(); settle(); },
      cancel() { stopped = true; win.clearTimeout(fallback); motions.forEach(motion => motion.cancel()); actor.remove(); tip.style.cssText = ''; delete tip.dataset.characterSide; },
    };
  };
  return { characters, normalizeCharacter, characterImage, readImage, layout, present: allowCharacters ? present : undefined, get effects() { return [...registry.values()]; }, register, normalize, play, cancel };
}

export const NOTE_ANIMATIONS = Object.freeze(createNoteAnimations().effects);
