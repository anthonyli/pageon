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
  const bubbleShapes = [
    { id: 'rounded', radius: '18px', label: { zh: '圆角矩形', en: 'Rounded rectangle' } },
    { id: 'square', radius: '0px', label: { zh: '矩形', en: 'Rectangle' } },
    { id: 'soft', radius: '32px', label: { zh: '大圆角', en: 'Soft rounded' } },
    { id: 'speech', radius: '18px 18px 18px 4px', label: { zh: '对话气泡', en: 'Speech bubble' } },
  ];
  const normalizeBubble = raw => {
    let value = raw;
    if (typeof raw === 'string') { try { value = raw.length <= 500 ? JSON.parse(raw) : null; } catch { value = null; } }
    const color = (value, fallback) => /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value || '') ? value.toLowerCase() : fallback;
    return { background: color(value?.background, '#ffffff'), color: color(value?.color, '#182022'),
      shape: bubbleShapes.some(shape => shape.id === value?.shape) ? value.shape : 'rounded' };
  };
  const applyBubble = (element, raw) => {
    const bubble = normalizeBubble(raw);
    element.style.backgroundColor = bubble.background;
    element.style.color = bubble.color;
    element.style.borderRadius = bubbleShapes.find(shape => shape.id === bubble.shape).radius;
  };
  const characters = [
    { id: 'dot', defaultColor: '#4678ff', label: { zh: '圆圈', en: 'Circle' } },
    { id: 'blob', defaultColor: '#4678ff', label: { zh: '软糖', en: 'Jelly' } },
    { id: 'spark', defaultColor: '#ffcc39', label: { zh: '小星', en: 'Spark' } },
    { id: 'frog', defaultColor: '#b6d80d', label: { zh: '小蛙', en: 'Frog' } },
    { id: 'bunny', defaultColor: '#a25aff', label: { zh: '兔耳', en: 'Bunny' } },
    { id: 'heart', defaultColor: '#dd6adc', label: { zh: '酷酷爱心', en: 'Cool heart' } },
    { id: 'monocle', defaultColor: '#ff8066', label: { zh: '单片眼镜', en: 'Monocle' } },
    { id: 'diamond', defaultColor: '#ffcc39', label: { zh: '酷酷菱形', en: 'Cool diamond' } },
    { id: 'glasses', defaultColor: '#02b1ff', label: { zh: '眼镜小蓝', en: 'Blue glasses' } },
    { id: 'headphones', defaultColor: '#fa70ab', label: { zh: '耳机兔', en: 'Headphone bunny' } },
    { id: 'thinking', defaultColor: '#02b1ff', label: { zh: '思考', en: 'Thinking' } },
    { id: 'custom', defaultColor: '#4678ff', label: { zh: '自己的图片', en: 'My image' } },
  ];
  // Migrate colors supplied by the previous built-in defaults only. User-picked
  // colors remain untouched, including values outside the shared presets.
  const previousDefaults = { blob: '#3989ed', spark: '#f3cc45', frog: '#b9dd58', bunny: '#a83ee8',
    heart: '#d54bd1', monocle: '#f47743', diamond: '#eee35b', glasses: '#48a9e4', headphones: '#e783a2', thinking: '#48a9e4' };
  const normalizeCharacter = raw => {
    let value = raw;
    if (typeof raw === 'string') { try { value = raw.length <= 190000 ? JSON.parse(raw) : null; } catch { value = null; } }
    const id = characters.some(item => item.id === value?.id) ? value.id : 'dot';
    const color = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value?.color || '') && value.color.toLowerCase() !== previousDefaults[id]
      ? value.color : characters.find(item => item.id === id).defaultColor;
    const image = typeof value?.image === 'string' && value.image.length <= 180000 && /^data:image\/(png|webp|jpeg);base64,[a-z0-9+/]+=*$/i.test(value.image) ? value.image : '';
    return { id, color, image };
  };
  // Defaults apply only on explicit role selection, never when reopening saved notes.
  const selectCharacter = (raw, id) => normalizeCharacter({ ...normalizeCharacter(raw), id, color: undefined });
  const characterImage = raw => {
    const { id, color, image } = normalizeCharacter(raw);
    if (id === 'custom' && image) return image;
    const eyes = '<ellipse cx="38" cy="49" rx="3.4" ry="5" fill="#192536"/><ellipse cx="58" cy="49" rx="3.4" ry="5" fill="#192536"/><circle cx="39" cy="47" r="1" fill="white"/><circle cx="59" cy="47" r="1" fill="white"/>';
    const smile = '<path d="M42 61 Q48 66 54 61" fill="none" stroke="#192536" stroke-width="2.5" stroke-linecap="round"/>';
    const bow = '<path d="M33 77 L48 82 L63 77 V90 L48 84 L33 90Z" fill="#273344"/>';
    const shades = '<path d="M23 40 H44 L47 45 H50 L53 40 H75 L71 55 Q62 63 54 54 L51 47 H45 L42 54 Q32 63 26 54Z" fill="#192536"/>';
    const glasses = '<g fill="none" stroke="#273344" stroke-width="3"><circle cx="34" cy="48" r="12"/><circle cx="62" cy="48" r="12"/><path d="M46 47 H50"/></g>';
    const blue = '<path d="M26 30 Q12 17 23 13 Q29 10 34 20 Q29 2 40 4 Q48 4 48 19 Q53 4 62 10 Q68 16 59 26 Q78 33 79 58 Q79 80 52 86 Q25 88 17 66 Q13 48 26 30Z" fill="url(#body)"/>';
    const bunny = '<path d="M30 30 Q20 0 33 4 Q45 4 44 29 Q45 6 57 9 Q71 11 61 32 Q82 42 80 62 Q78 86 49 87 Q18 86 16 62 Q14 42 30 30Z" fill="url(#body)"/>';
    const body = id === 'bunny' ? bunny + eyes + smile
      : id === 'headphones' ? bunny + '<path d="M12 53 Q10 20 48 20 Q86 20 84 53 M13 51 V66 M83 51 V66" fill="none" stroke="#273344" stroke-width="6" stroke-linecap="round"/><path d="M29 50 Q35 58 41 50 M55 50 Q61 58 67 50" fill="none" stroke="#192536" stroke-width="3" stroke-linecap="round"/>' + smile
      : id === 'heart' ? '<path d="M48 25 C18 -4 0 28 16 48 L41 83 Q48 91 55 83 L80 48 C96 28 78 -4 48 25Z" fill="url(#body)"/>' + shades + smile
      : id === 'diamond' ? '<circle cx="48" cy="13" r="11" fill="url(#body)"/><path d="M43 28 Q48 23 53 28 L82 54 Q88 60 82 67 L54 91 Q48 96 42 91 L14 67 Q8 60 14 54Z" fill="url(#body)"/>' + shades + smile
      : id === 'glasses' || id === 'thinking' ? blue + eyes + glasses + smile + (id === 'thinking' ? '<g><path d="M76 6 C60 6 60 23 69 29 V34 H81 V29 C92 21 90 6 76 6Z" fill="#ffd66b" stroke="#b88024" stroke-width="2"/><path d="M70 37 H80 M72 40 H78" stroke="#657280" stroke-width="3"/><path d="M75 0 V3 M92 9 L95 7 M59 9 L56 7" stroke="#e8b94c" stroke-width="2"/></g>' : '')
      : id === 'monocle' ? '<path d="M30 15 Q40 4 51 14 Q65 7 72 23 Q88 24 84 42 Q95 54 82 65 Q86 81 68 82 Q54 96 43 84 Q25 91 21 76 Q5 74 13 56 Q4 43 18 33 Q15 19 30 15Z" fill="url(#body)"/>' + eyes + '<circle cx="59" cy="49" r="12" fill="none" stroke="#273344" stroke-width="4"/><path d="M69 58 Q73 74 84 71" fill="none" stroke="#273344" stroke-width="3"/>' + smile
      : id === 'blob'
      ? '<path d="M25 22 Q28 10 40 17 Q50 7 60 19 Q76 15 77 32 Q91 40 80 55 Q87 71 70 75 Q62 91 48 80 Q32 90 25 75 Q8 71 17 55 Q5 39 20 32Z" fill="url(#body)"/><ellipse cx="45" cy="22" rx="25" ry="9" transform="rotate(-18 45 22)" fill="#202b38"/>' + eyes + smile
      : id === 'spark'
      ? '<path d="M36 18 Q48 5 60 18 L82 64 Q90 84 68 84 H28 Q6 84 14 64Z" fill="url(#body)"/>' + eyes + '<g fill="none" stroke="#273344" stroke-width="2.5"><ellipse cx="36" cy="48" rx="12" ry="15"/><ellipse cx="60" cy="48" rx="12" ry="15"/><path d="M48 46 h0"/></g><path d="M33 77 L48 82 L63 77 V90 L48 84 L33 90Z" fill="#273344"/>'
      : id === 'frog'
      ? '<path d="M20 38 Q10 12 32 13 Q46 13 48 30 Q50 13 64 13 Q86 12 76 38 Q92 48 82 70 Q76 85 48 84 Q20 85 14 70 Q4 48 20 38Z" fill="url(#body)"/><g fill="white"><ellipse cx="31" cy="28" rx="10" ry="12"/><ellipse cx="65" cy="28" rx="10" ry="12"/></g><g fill="#192536"><ellipse cx="32" cy="29" rx="5" ry="7"/><ellipse cx="64" cy="29" rx="5" ry="7"/></g>' + smile + bow
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
  return { bubbleShapes, normalizeBubble, applyBubble, characters, normalizeCharacter, selectCharacter, characterImage, readImage, layout, present: allowCharacters ? present : undefined, get effects() { return [...registry.values()]; }, register, normalize, play, cancel };
}

export const NOTE_ANIMATIONS = Object.freeze(createNoteAnimations().effects);
