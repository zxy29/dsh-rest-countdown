/**
 * Off-work countdown — browser half.
 *
 * Contributes three surfaces:
 *   - one row to the sidebar shell's own global panel list (`sidebar.panellist`);
 *   - one page to the layout's keyed `main` slot (the full-size card + settings);
 *   - one resident card to the frame-wide `shell.overlay` layer, so the countdown
 *     is visible while working in the workspace instead of only after opening the
 *     sidebar entry. The overlay collapses to a small pill and remembers that.
 *
 * The shell owns the row box, label, tooltip, active highlight and panel switch,
 * and the overlay layer is click-through, so only the card itself takes pointer
 * events. This file draws the glyph, the page and the floating card.
 *
 * The card has three states, all driven by the local clock:
 *   - before the start time: "before work", the day's quitting time, an empty bar;
 *   - during working hours: a live hour/minute/second countdown and a bar filled
 *     by the share of the workday already spent;
 *   - after quitting time, or on a day off: the green "good work today" card with
 *     a full bar and the next workday's quitting time (明天/周一 18:30, 100%).
 *
 * Working hours are a browser-local preference shared by both surfaces, edited on
 * the page and kept in localStorage, so the countdown survives reloads without a
 * Host route and the Host half stays inert.
 */

window.__ModuleLoader__.load({
  id: 'dsh-rest-countdown',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Panel id shared by the sidebar row and the main-slot occupant. */
    const PANEL_ID = 'off-work'

    /** Locale namespace this plugin owns. */
    const NS = 'off-work-countdown'

    /** Browser-local preference key for working hours. */
    const STORAGE_KEY = 'dsh.off-work-countdown.prefs'

    /** Browser-local preference key for the floating card's collapsed state. */
    const OVERLAY_KEY = 'dsh.off-work-countdown.overlay'

    /** Browser-local preference key for the floating card's dragged position. */
    const POSITION_KEY = 'dsh.off-work-countdown.position'

    /** Browser-local preference key for the floating card's opacity. */
    const OPACITY_KEY = 'dsh.off-work-countdown.opacity'

    /** Smallest gap kept between a dragged card and the window edge. */
    const DRAG_MARGIN = 8

    /** Opacity bounds for the floating card (never below legibility). */
    const MIN_OPACITY = 0.3
    const MAX_OPACITY = 1

    /** Cycle order of the card's opacity tool, full to see-through and back. */
    const OPACITY_STEPS = [1, 0.85, 0.7, 0.55, 0.4]

    /** Row order among the shell's global panel rows (Plugins 0, Schedules 10, Task Records 20, SSH 40). */
    const PANEL_ORDER = 30

    /** Floating card order in the frame overlay layer (above the whale pet at 90 so the countdown stays readable). */
    const OVERLAY_ORDER = 95

    /** Default working hours: 09:30–18:30, Monday to Friday. */
    const DEFAULT_PREFS = { start: '09:30', end: '18:30', days: [1, 2, 3, 4, 5] }

    /** Chips run Monday first; JS weekdays run Sunday first. */
    const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

    // ------------------------------------------------------------ locale

    const zh = {
      'entry.label': '牛马休息倒计时',
      'page.title': '牛马休息倒计时',
      'page.subtitle': '按这台电脑的时钟计算；下班后自动换成「今天辛苦了」。',
      'card.until': '距离下班',
      'card.before': '还没上班',
      'card.off': '已下班',
      'card.rest': '休息日',
      'card.beforeText': '今天 {time} 下班',
      'card.message.off': '今天辛苦了。',
      'card.message.rest': '今天休息，好好放松。',
      'card.progress': '今日工作进度',
      'foot.today': '今天',
      'foot.tomorrow': '明天',
      'unit.hour': '小时',
      'unit.min': '分',
      'unit.sec': '秒',
      'weekday.0': '周日',
      'weekday.1': '周一',
      'weekday.2': '周二',
      'weekday.3': '周三',
      'weekday.4': '周四',
      'weekday.5': '周五',
      'weekday.6': '周六',
      'settings.title': '工作时间',
      'settings.start': '上班',
      'settings.end': '下班',
      'settings.days': '工作日',
      'settings.reset': '恢复默认',
      'settings.hint': '设置只保存在这台电脑的浏览器里。',
      'settings.invalid': '上班时间需要早于下班时间。',
      'settings.needDay': '至少要选一个工作日。',
      'settings.opacity': '透明度',
      'float.open': '打开牛马休息倒计时页',
      'float.fold': '收起为小胶囊',
      'float.expand': '展开牛马休息倒计时',
      'float.reset': '重置位置',
      'float.opacity': '透明度 {value}（点击切换）',
      'float.before': '{time} 下班',
    }

    const en = {
      'entry.label': 'Workhorse rest countdown',
      'page.title': 'Workhorse rest countdown',
      'page.subtitle': "Counted on this computer's clock; the card turns green once the day is done.",
      'card.until': 'Time until off work',
      'card.before': 'Before work',
      'card.off': 'Off work',
      'card.rest': 'Day off',
      'card.beforeText': 'Off at {time} today',
      'card.message.off': 'Good work today.',
      'card.message.rest': 'Enjoy your day off.',
      'card.progress': 'Workday progress',
      'foot.today': 'Today',
      'foot.tomorrow': 'Tomorrow',
      'unit.hour': 'h',
      'unit.min': 'm',
      'unit.sec': 's',
      'weekday.0': 'Sun',
      'weekday.1': 'Mon',
      'weekday.2': 'Tue',
      'weekday.3': 'Wed',
      'weekday.4': 'Thu',
      'weekday.5': 'Fri',
      'weekday.6': 'Sat',
      'settings.title': 'Working hours',
      'settings.start': 'Start',
      'settings.end': 'End',
      'settings.days': 'Workdays',
      'settings.reset': 'Reset',
      'settings.hint': 'Saved in this browser only.',
      'settings.invalid': 'Start needs to be before end.',
      'settings.needDay': 'Pick at least one workday.',
      'settings.opacity': 'Opacity',
      'float.open': 'Open the countdown page',
      'float.fold': 'Collapse to a pill',
      'float.expand': 'Expand the workhorse rest countdown',
      'float.reset': 'Reset position',
      'float.opacity': 'Opacity {value} (click to cycle)',
      'float.before': 'Off at {time}',
    }

    /** Locale service from apply; null when the profile has none. */
    let locale = null

    /** Namespace translate function from apply; null before activation. */
    let translate = null

    /** Layout service from apply; null when the shell has none. */
    let layout = null

    /** The active locale id, read at call time so a switch follows immediately. */
    function activeLocaleId() {
      if (locale !== null && typeof locale.getSnapshot === 'function') {
        try {
          const snapshot = locale.getSnapshot()
          if (snapshot !== null && typeof snapshot === 'object' && typeof snapshot.active === 'string' && snapshot.active !== '') {
            return snapshot.active
          }
        } catch {
          /* fall through to the browser preference */
        }
      }
      const language = typeof navigator !== 'undefined' && typeof navigator.language === 'string' ? navigator.language : 'en'
      return language
    }

    /** Whether the active locale reads as Chinese. */
    function isChinese() {
      return activeLocaleId().toLowerCase().startsWith('zh')
    }

    /**
     * Translate one key of this plugin's namespace.
     * @param {string} key - dotted key from the dictionaries above.
     * @returns {string} the active-locale text, else the platform text.
     */
    function t(key) {
      if (translate !== null) {
        try {
          const value = translate(key)
          if (typeof value === 'string' && value !== key) return value
        } catch {
          /* fall back to the bundled dictionary */
        }
      }
      const dictionary = isChinese() ? zh : en
      const value = dictionary[key]
      return typeof value === 'string' ? value : key
    }

    /**
     * Translate one key and fill its `{name}` placeholders.
     * @param {string} key - dotted key from the dictionaries above.
     * @param {Record<string, string>} values - placeholder values.
     * @returns {string} the filled text.
     */
    function tf(key, values) {
      let text = t(key)
      for (const name of Object.keys(values)) {
        text = text.split('{' + name + '}').join(values[name])
      }
      return text
    }

    // ---------------------------------------------------------- time math

    /** Zero pad one clock field. */
    function pad2(value) {
      return String(value).padStart(2, '0')
    }

    /**
     * Minutes since local midnight for one `HH:MM` string.
     * @param {unknown} value - candidate time string.
     * @returns {number | null} the minute count, or null when malformed.
     */
    function minutesOf(value) {
      if (typeof value !== 'string') return null
      const match = /^(\d{1,2}):(\d{2})$/.exec(value)
      if (match === null) return null
      const hours = Number(match[1])
      const minutes = Number(match[2])
      if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
      return hours * 60 + minutes
    }

    /** Whether one value is a well-formed `HH:MM` clock time. */
    function isTime(value) {
      return minutesOf(value) !== null
    }

    /**
     * The local Date of one clock minute on a day relative to `now`.
     * @param {Date} now - reference instant.
     * @param {number} minutes - minutes since local midnight.
     * @param {number} dayOffset - whole days from today.
     * @returns {Date} local Date.
     */
    function atTime(now, minutes, dayOffset) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset)
      date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
      return date
    }

    /** Localized short weekday name of one JS weekday index (0 = Sunday). */
    function weekdayName(index) {
      return t('weekday.' + index)
    }

    /**
     * How the footer names a day: 今天/明天, else the weekday.
     * @param {number} dayOffset - whole days from today.
     * @param {Date} now - reference instant.
     * @returns {string} localized day name.
     */
    function footDayText(dayOffset, now) {
      if (dayOffset === 0) return t('foot.today')
      if (dayOffset === 1) return t('foot.tomorrow')
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset)
      return weekdayName(date.getDay())
    }

    /**
     * First workday on or after `fromOffset` whole days from today.
     * @param {Date} now - reference instant.
     * @param {number[]} days - JS weekday indexes treated as workdays.
     * @param {number} fromOffset - first offset to test.
     * @returns {number} the offset of the next workday.
     */
    function nextWorkdayOffset(now, days, fromOffset) {
      for (let offset = fromOffset; offset <= fromOffset + 7; offset += 1) {
        const probe = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
        if (days.includes(probe.getDay())) return offset
      }
      return fromOffset
    }

    /**
     * Hour/minute/second parts of one remaining duration.
     * @param {number} milliseconds - remaining time.
     * @returns {{hours: number, minutes: number, seconds: number}} whole parts.
     */
    function durationParts(milliseconds) {
      const total = Math.max(0, Math.floor(milliseconds / 1000))
      return {
        hours: Math.floor(total / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
      }
    }

    /**
     * The live countdown, at second granularity, in the active locale.
     * @param {number} milliseconds - remaining time.
     * @returns {string} text such as `2 小时 13 分 05 秒` or `2h 13m 05s`.
     */
    function remainingText(milliseconds) {
      const parts = durationParts(milliseconds)
      // Chinese separates a number from its unit; `2h 13m 05s` does not want a gap.
      const gap = isChinese() ? ' ' : ''
      const segments = []
      if (parts.hours > 0) segments.push(parts.hours + gap + t('unit.hour'))
      if (parts.hours > 0 || parts.minutes > 0) segments.push(pad2(parts.minutes) + gap + t('unit.min'))
      segments.push(pad2(parts.seconds) + gap + t('unit.sec'))
      return segments.join(' ')
    }

    /**
     * The compact countdown for the collapsed pill: hours and minutes only.
     * @param {number} milliseconds - remaining time.
     * @returns {string} text such as `2 小时 13 分` or `2h 13m`.
     */
    function remainingShort(milliseconds) {
      const parts = durationParts(milliseconds)
      const gap = isChinese() ? ' ' : ''
      if (parts.hours > 0) return parts.hours + gap + t('unit.hour') + ' ' + pad2(parts.minutes) + gap + t('unit.min')
      if (parts.minutes > 0) return parts.minutes + gap + t('unit.min')
      return parts.seconds + gap + t('unit.sec')
    }

    // ------------------------------------------------------- preferences

    /**
     * Keep only the fields this page understands, or reject the whole value.
     * @param {unknown} input - parsed storage value or draft preference.
     * @returns {{start: string, end: string, days: number[]} | null} clean prefs.
     */
    function normalizePrefs(input) {
      if (input === null || typeof input !== 'object') return null
      const start = input.start
      const end = input.end
      if (!isTime(start) || !isTime(end)) return null
      if (!Array.isArray(input.days)) return null
      const days = []
      for (const raw of input.days) {
        const day = Number(raw)
        if (Number.isInteger(day) && day >= 0 && day <= 6 && !days.includes(day)) days.push(day)
      }
      if (days.length === 0) return null
      days.sort((a, b) => a - b)
      return { start: start, end: end, days: days }
    }

    /** Whether a clean preference describes a non-empty working span. */
    function hasValidSpan(prefs) {
      return prefs !== null && minutesOf(prefs.start) < minutesOf(prefs.end)
    }

    /** Read the stored working hours, falling back to the defaults. */
    function loadPrefs() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (raw === null) return DEFAULT_PREFS
        const parsed = JSON.parse(raw)
        const normalized = normalizePrefs(parsed)
        return hasValidSpan(normalized) ? normalized : DEFAULT_PREFS
      } catch {
        return DEFAULT_PREFS
      }
    }

    /** Persist one preference object; a full or blocked storage keeps the session working. */
    function savePrefs(prefs) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
      } catch {
        /* private mode or quota: the surfaces still work for this session */
      }
    }

    /**
     * The shared preference value: the page's settings row and the floating card
     * are mounted at the same time, so both read one source and repaint together.
     */
    let sharedPrefs = null
    const prefsListeners = new Set()

    /** Current raw preference object (validated by each consumer). */
    function currentPrefs() {
      if (sharedPrefs === null) sharedPrefs = loadPrefs()
      return sharedPrefs
    }

    /** Store one preference object, persist it, and repaint every surface. */
    function commitPrefs(next) {
      sharedPrefs = next
      savePrefs(next)
      for (const listener of prefsListeners) {
        try {
          listener()
        } catch {
          /* one broken surface must not stop the others */
        }
      }
    }

    /** Apply a functional update to the shared preference object. */
    function mutatePrefs(updater) {
      commitPrefs(updater(currentPrefs()))
    }

    /**
     * Subscribe to preference changes.
     * @param {() => void} listener - called after every commit.
     * @returns {() => void} unsubscribe.
     */
    function subscribePrefs(listener) {
      prefsListeners.add(listener)
      return () => prefsListeners.delete(listener)
    }

    /** Whether the floating card is collapsed to its pill form. */
    function loadOverlayMode() {
      try {
        return window.localStorage.getItem(OVERLAY_KEY) === 'pill' ? 'pill' : 'card'
      } catch {
        return 'card'
      }
    }

    /** Remember the floating card's collapsed state. */
    function saveOverlayMode(mode) {
      try {
        window.localStorage.setItem(OVERLAY_KEY, mode)
      } catch {
        /* the card still toggles for this session */
      }
    }

    /**
     * The floating card's dragged position, or null for the default corner.
     * @returns {{x: number, y: number} | null} viewport pixel position.
     */
    function loadPosition() {
      try {
        const raw = window.localStorage.getItem(POSITION_KEY)
        if (raw === null) return null
        const parsed = JSON.parse(raw)
        if (parsed === null || typeof parsed !== 'object') return null
        const x = Number(parsed.x)
        const y = Number(parsed.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        return { x: x, y: y }
      } catch {
        return null
      }
    }

    /**
     * Remember one dragged position; null returns the card to the default corner.
     * @param {{x: number, y: number} | null} position - viewport pixel position.
     */
    function savePosition(position) {
      try {
        if (position === null) window.localStorage.removeItem(POSITION_KEY)
        else window.localStorage.setItem(POSITION_KEY, JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) }))
      } catch {
        /* the card still drags for this session */
      }
    }

    /**
     * Clamp one opacity into the legible range, rounded to a whole percent.
     * @param {unknown} value - stored or requested opacity.
     * @returns {number} opacity between MIN_OPACITY and MAX_OPACITY.
     */
    function normalizeOpacity(value) {
      const number = Number(value)
      if (!Number.isFinite(number)) return MAX_OPACITY
      return Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, Math.round(number * 100) / 100))
    }

    /** Read the stored floating-card opacity, falling back to fully opaque. */
    function loadOpacity() {
      try {
        const raw = window.localStorage.getItem(OPACITY_KEY)
        return raw === null ? MAX_OPACITY : normalizeOpacity(raw)
      } catch {
        return MAX_OPACITY
      }
    }

    /** Persist one opacity; a blocked storage keeps the session value. */
    function saveOpacity(value) {
      try {
        window.localStorage.setItem(OPACITY_KEY, String(normalizeOpacity(value)))
      } catch {
        /* private mode or quota: the card still dims for this session */
      }
    }

    /** Shared opacity value for the page slider and the floating card's tool. */
    let sharedOpacity = null
    const opacityListeners = new Set()

    /** Current floating-card opacity. */
    function currentOpacity() {
      if (sharedOpacity === null) sharedOpacity = loadOpacity()
      return sharedOpacity
    }

    /** Store, persist, and repaint one opacity across every surface. */
    function commitOpacity(next) {
      sharedOpacity = normalizeOpacity(next)
      saveOpacity(sharedOpacity)
      for (const listener of opacityListeners) {
        try {
          listener()
        } catch {
          /* one broken surface must not stop the others */
        }
      }
    }

    /**
     * Subscribe to opacity changes.
     * @param {() => void} listener - called after every commit.
     * @returns {() => void} unsubscribe.
     */
    function subscribeOpacity(listener) {
      opacityListeners.add(listener)
      return () => opacityListeners.delete(listener)
    }

    /**
     * The next step in the card's opacity cycle, wrapping back to full.
     * @param {number} current - current opacity.
     * @returns {number} the next preset.
     */
    function nextOpacity(current) {
      for (const step of OPACITY_STEPS) {
        if (step < current - 0.001) return step
      }
      return OPACITY_STEPS[0]
    }

    /** One opacity as a whole-percent label. */
    function opacityPercent(value) {
      return Math.round(normalizeOpacity(value) * 100) + '%'
    }

    /** The smallest top edge a floating surface may use (the shell's header band). */
    function topClearance() {
      let clearance = 56
      try {
        if (typeof window.getComputedStyle === 'function' && typeof document !== 'undefined') {
          const raw = window.getComputedStyle(document.documentElement).getPropertyValue('--dsh-frame-top-clearance')
          const parsed = parseFloat(raw)
          if (Number.isFinite(parsed)) clearance = Math.max(clearance, parsed)
        }
      } catch {
        /* keep the default band */
      }
      return clearance
    }

    /**
     * Clamp one floating position into the viewport and below the header band.
     * @param {number} x - proposed left edge.
     * @param {number} y - proposed top edge.
     * @param {number} width - measured card width.
     * @param {number} height - measured card height.
     * @returns {{x: number, y: number}} the clamped position.
     */
    function clampPosition(x, y, width, height) {
      const viewportWidth = typeof window.innerWidth === 'number' && window.innerWidth > 0 ? window.innerWidth : 1280
      const viewportHeight = typeof window.innerHeight === 'number' && window.innerHeight > 0 ? window.innerHeight : 800
      const minY = topClearance()
      const maxX = Math.max(DRAG_MARGIN, viewportWidth - width - DRAG_MARGIN)
      const maxY = Math.max(minY, viewportHeight - height - DRAG_MARGIN)
      return {
        x: Math.min(Math.max(DRAG_MARGIN, x), maxX),
        y: Math.min(Math.max(minY, y), maxY),
      }
    }

    // ------------------------------------------------------------- state

    /**
     * The card's state for one instant and one set of working hours.
     * @param {Date} now - current local time.
     * @param {{start: string, end: string, days: number[]}} prefs - valid hours.
     * @returns {{phase: 'before'|'working'|'off'|'rest', barPercent: number, percent: number, remainingMs: number, endText: string, footLeft: string}} state.
     */
    function resolveState(now, prefs) {
      const startMinutes = minutesOf(prefs.start)
      const endMinutes = minutesOf(prefs.end)
      const startAt = atTime(now, startMinutes, 0)
      const endAt = atTime(now, endMinutes, 0)
      const worksToday = prefs.days.includes(now.getDay())

      if (!worksToday) {
        const offset = nextWorkdayOffset(now, prefs.days, 1)
        return {
          phase: 'rest',
          barPercent: 100,
          percent: 100,
          remainingMs: 0,
          endText: prefs.end,
          footLeft: footDayText(offset, now) + ' ' + prefs.end,
        }
      }

      if (now.getTime() < startAt.getTime()) {
        return {
          phase: 'before',
          barPercent: 0,
          percent: 0,
          remainingMs: startAt.getTime() - now.getTime(),
          endText: prefs.end,
          footLeft: footDayText(0, now) + ' ' + prefs.end,
        }
      }

      if (now.getTime() < endAt.getTime()) {
        const span = Math.max(1, endAt.getTime() - startAt.getTime())
        const fraction = Math.min(1, Math.max(0, (now.getTime() - startAt.getTime()) / span))
        return {
          phase: 'working',
          barPercent: Math.min(99, Math.round(fraction * 1000) / 10),
          percent: Math.min(99, Math.floor(fraction * 100)),
          remainingMs: endAt.getTime() - now.getTime(),
          endText: prefs.end,
          footLeft: footDayText(0, now) + ' ' + prefs.end,
        }
      }

      const offset = nextWorkdayOffset(now, prefs.days, 1)
      return {
        phase: 'off',
        barPercent: 100,
        percent: 100,
        remainingMs: 0,
        endText: prefs.end,
        footLeft: footDayText(offset, now) + ' ' + prefs.end,
      }
    }

    /**
     * Shared clock + preference + derived state for every surface.
     * @returns {{prefs: object, activePrefs: object, normalized: object | null, spanValid: boolean, state: object, opacity: number}} surface inputs.
     */
    function useCountdown() {
      const [prefs, setPrefsState] = React.useState(currentPrefs)
      const [now, setNow] = React.useState(() => new Date())
      const [opacity, setOpacity] = React.useState(currentOpacity)
      const [, setLocaleVersion] = React.useState(0)

      // One clock per surface: every displayed value is derived from it, so a
      // throttled background tab corrects itself on the next tick.
      React.useEffect(() => {
        const id = window.setInterval(() => setNow(new Date()), 1000)
        return () => window.clearInterval(id)
      }, [])

      React.useEffect(() => subscribePrefs(() => setPrefsState(currentPrefs())), [])

      React.useEffect(() => subscribeOpacity(() => setOpacity(currentOpacity())), [])

      // A locale switch must repaint the text; the service bumps its revision on
      // every switch and on late dictionary registration.
      React.useEffect(() => {
        if (locale === null || typeof locale.subscribe !== 'function') return undefined
        return locale.subscribe(() => setLocaleVersion((value) => value + 1))
      }, [])

      const normalized = normalizePrefs(prefs)
      const spanValid = hasValidSpan(normalized)
      const activePrefs = spanValid ? normalized : DEFAULT_PREFS
      return {
        prefs: prefs,
        activePrefs: activePrefs,
        normalized: normalized,
        spanValid: spanValid,
        state: resolveState(now, activePrefs),
        opacity: opacity,
      }
    }

    // ------------------------------------------------------------- icons

    /** Shared stroke-icon frame. */
    function icon(size, children, strokeWidth) {
      return h(
        'svg',
        {
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: strokeWidth === undefined ? 1.4 : strokeWidth,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
        },
        children,
      )
    }

    /** The sidebar row glyph: a small clock. */
    function CountdownIcon(props) {
      const size = props !== null && typeof props === 'object' && typeof props.size === 'number' ? props.size : 16
      return icon(size, [
        h('circle', { key: 'dial', cx: 8, cy: 8, r: 5.9 }),
        h('path', { key: 'hour', d: 'M8 4.6V7.4' }),
        h('path', { key: 'minute', d: 'M8 7.4l2.5 1.6' }),
      ])
    }

    /** Clock mark for the "still counting" states. */
    function clockIcon() {
      return icon(17, [
        h('circle', { key: 'dial', cx: 8, cy: 8, r: 6.3 }),
        h('path', { key: 'hour', d: 'M8 4.1v3.9' }),
        h('path', { key: 'minute', d: 'M8 8l2.7 1.7' }),
      ], 1.5)
    }

    /** Filled-outlined check circle for the "off work" state. */
    function checkCircleIcon() {
      return icon(17, [
        h('circle', { key: 'dial', cx: 8, cy: 8, r: 6.3 }),
        h('path', { key: 'check', d: 'M5.2 8.2l1.9 1.9 3.7-4.2' }),
      ], 1.6)
    }

    /** Coffee cup for the day-off state. */
    function coffeeIcon() {
      return icon(17, [
        h('path', { key: 'cup', d: 'M3.1 6.5h7.8v2.6a3.9 3.9 0 0 1-7.8 0z' }),
        h('path', { key: 'handle', d: 'M10.9 7.2h1.4a1.6 1.6 0 0 1 0 3.2h-1.4' }),
        h('path', { key: 'saucer', d: 'M2.6 13h9.6' }),
        h('path', { key: 'steam', d: 'M5.6 3.1v1.5M8.4 3.1v1.5' }),
      ], 1.4)
    }

    /** Status mark of one phase. */
    function statusIcon(phase) {
      if (phase === 'off') return checkCircleIcon()
      if (phase === 'rest') return coffeeIcon()
      return clockIcon()
    }

    /** Sliders mark: opens the full countdown page. */
    function slidersIcon() {
      return icon(14, [
        h('path', { key: 'l1', d: 'M2.5 4.4h11' }),
        h('circle', { key: 'k1', cx: 6.1, cy: 4.4, r: 1.5 }),
        h('path', { key: 'l2', d: 'M2.5 8h11' }),
        h('circle', { key: 'k2', cx: 10.2, cy: 8, r: 1.5 }),
        h('path', { key: 'l3', d: 'M2.5 11.6h11' }),
        h('circle', { key: 'k3', cx: 5.4, cy: 11.6, r: 1.5 }),
      ])
    }

    /** Chevron mark: collapses the floating card. */
    function foldIcon() {
      return icon(14, [h('path', { key: 'chevron', d: 'M4.2 6.2L8 10l3.8-3.8' })], 1.7)
    }

    /** Crosshair mark: returns a dragged card to its default corner. */
    function targetIcon() {
      return icon(14, [
        h('circle', { key: 'ring', cx: 8, cy: 8, r: 4.4 }),
        h('path', { key: 'top', d: 'M8 1.7v2.2' }),
        h('path', { key: 'bottom', d: 'M8 12.1v2.2' }),
        h('path', { key: 'left', d: 'M1.7 8h2.2' }),
        h('path', { key: 'right', d: 'M12.1 8h2.2' }),
      ])
    }

    /** Half-filled circle mark: cycles the floating card's opacity. */
    function contrastIcon() {
      return icon(14, [
        h('circle', { key: 'ring', cx: 8, cy: 8, r: 5.6 }),
        h('path', { key: 'half', d: 'M8 2.4a5.6 5.6 0 0 0 0 11.2z', fill: 'currentColor', stroke: 'none' }),
      ])
    }

    // -------------------------------------------------------------- view

    /** Headline text of one state. */
    function headlineOf(state) {
      if (state.phase === 'working') return remainingText(state.remainingMs)
      if (state.phase === 'before') return tf('card.beforeText', { time: state.endText })
      if (state.phase === 'rest') return t('card.message.rest')
      return t('card.message.off')
    }

    /** Status label of one state. */
    function statusOf(state) {
      if (state.phase === 'working') return t('card.until')
      if (state.phase === 'before') return t('card.before')
      if (state.phase === 'rest') return t('card.rest')
      return t('card.off')
    }

    /** Card class suffix of one state. */
    function phaseClass(state) {
      if (state.phase === 'before') return ' is-idle'
      if (state.phase === 'working') return ' is-live'
      return ' is-done'
    }

    /** The status, headline, bar and footer shared by the page card and the floating card. */
    function cardBody(state) {
      return [
        h(
          'div',
          { className: 'dwo-status', key: 'status' },
          h('span', { className: 'dwo-status-mark' }, statusIcon(state.phase)),
          h('span', { className: 'dwo-status-text' }, statusOf(state)),
        ),
        h('p', { className: 'dwo-headline', key: 'headline' }, headlineOf(state)),
        h(
          'div',
          {
            className: 'dwo-track',
            key: 'track',
            role: 'progressbar',
            'aria-label': t('card.progress'),
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': state.percent,
          },
          h('div', { className: 'dwo-fill', style: { width: state.barPercent + '%' } }),
        ),
        h(
          'div',
          { className: 'dwo-foot', key: 'foot' },
          h('span', { className: 'dwo-foot-left' }, state.footLeft),
          h('span', { className: 'dwo-foot-right' }, state.percent + '%'),
        ),
      ]
    }

    /** One weekday toggle chip. */
    function dayChip(index, active, onToggle) {
      return h(
        'button',
        {
          key: 'day:' + index,
          type: 'button',
          className: 'dwo-day' + (active ? ' is-on' : ''),
          'aria-pressed': active,
          title: weekdayName(index),
          onClick: () => onToggle(index),
        },
        weekdayName(index),
      )
    }

    /** The countdown page mounted into the layout's `main` slot. */
    function OffWorkPage() {
      const { activePrefs, normalized, spanValid, state, opacity } = useCountdown()

      function setStart(value) {
        if (!isTime(value)) return
        mutatePrefs((current) => Object.assign({}, current, { start: value }))
      }

      function setEnd(value) {
        if (!isTime(value)) return
        mutatePrefs((current) => Object.assign({}, current, { end: value }))
      }

      function toggleDay(index) {
        mutatePrefs((current) => {
          const days = current.days.includes(index) ? current.days.filter((day) => day !== index) : current.days.concat([index]).sort((a, b) => a - b)
          // The last workday cannot be removed: an empty schedule has no span.
          if (days.length === 0) return current
          return Object.assign({}, current, { days: days })
        })
      }

      function resetPrefs() {
        mutatePrefs(() => DEFAULT_PREFS)
      }

      function changeOpacity(value) {
        commitOpacity(Number(value))
      }

      const warning = !spanValid ? t('settings.invalid') : normalized === null ? t('settings.needDay') : ''

      return h(
        'div',
        { className: 'dwo-root' },
        h('style', null, CSS),
        h(
          'div',
          { className: 'dwo-content' },
          h(
            'header',
            { className: 'dwo-header' },
            h('h1', { className: 'dwo-title' }, t('page.title')),
            h('p', { className: 'dwo-subtitle' }, t('page.subtitle')),
          ),
          h('section', { className: 'dwo-card' + phaseClass(state) }, cardBody(state)),
          h(
            'section',
            { className: 'dwo-settings' },
            h(
              'div',
              { className: 'dwo-settings-head' },
              h('h2', { className: 'dwo-settings-title' }, t('settings.title')),
              h('button', { type: 'button', className: 'dwo-reset', onClick: resetPrefs }, t('settings.reset')),
            ),
            h(
              'div',
              { className: 'dwo-row' },
              h(
                'label',
                { className: 'dwo-field' },
                h('span', null, t('settings.start')),
                h('input', {
                  type: 'time',
                  step: 60,
                  className: 'dwo-time',
                  value: activePrefs.start,
                  onChange: (event) => setStart(event.target.value),
                }),
              ),
              h(
                'label',
                { className: 'dwo-field' },
                h('span', null, t('settings.end')),
                h('input', {
                  type: 'time',
                  step: 60,
                  className: 'dwo-time',
                  value: activePrefs.end,
                  onChange: (event) => setEnd(event.target.value),
                }),
              ),
            ),
            h(
              'div',
              { className: 'dwo-row' },
              h('span', { className: 'dwo-field-label' }, t('settings.days')),
              h(
                'div',
                { className: 'dwo-days' },
                DAY_ORDER.map((index) => dayChip(index, activePrefs.days.includes(index), toggleDay)),
              ),
            ),
            h(
              'div',
              { className: 'dwo-row' },
              h('span', { className: 'dwo-field-label' }, t('settings.opacity')),
              h('input', {
                type: 'range',
                className: 'dwo-range',
                min: MIN_OPACITY,
                max: MAX_OPACITY,
                step: 0.05,
                value: opacity,
                'aria-label': t('settings.opacity'),
                onChange: (event) => changeOpacity(event.target.value),
              }),
              h('span', { className: 'dwo-range-value' }, opacityPercent(opacity)),
            ),
            warning === '' ? null : h('p', { className: 'dwo-warn', role: 'alert' }, warning),
            h('p', { className: 'dwo-hint' }, t('settings.hint')),
          ),
        ),
      )
    }

    /**
     * The resident card in the frame overlay layer: visible while working in the
     * workspace, draggable to any corner, collapsible to a pill, and linked to
     * the full page for settings. A dragged position is remembered; the default
     * stays the bottom-right corner, so an untouched card follows window resizes.
     */
    function FloatingCountdown() {
      const { state, opacity } = useCountdown()
      const [mode, setMode] = React.useState(loadOverlayMode)
      const [position, setPosition] = React.useState(loadPosition)
      const [dragging, setDragging] = React.useState(false)
      const cardRef = React.useRef(null)
      const dragRef = React.useRef(null)
      const positionRef = React.useRef(position)
      positionRef.current = position

      function changeMode(next) {
        setMode(next)
        saveOverlayMode(next)
      }

      function openPage() {
        if (layout === null || typeof layout.selectPanel !== 'function') return
        try {
          layout.selectPanel(PANEL_ID)
        } catch {
          /* the shell may refuse navigation while another panel owns it */
        }
      }

      /** Begin a drag on the card's own surface (tools and controls keep their clicks). */
      function startDrag(event) {
        if (event.button !== 0) return
        const target = event.target
        if (target !== null && typeof target === 'object' && typeof target.closest === 'function' && target.closest('button, input, a') !== null) return
        const card = cardRef.current
        if (card === null || typeof card !== 'object' || typeof card.getBoundingClientRect !== 'function') return
        const rect = card.getBoundingClientRect()
        dragRef.current = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: rect.left,
          originY: rect.top,
          width: rect.width,
          height: rect.height,
          moved: false,
        }
        setDragging(true)
        if (event.currentTarget !== null && typeof event.currentTarget === 'object' && typeof event.currentTarget.setPointerCapture === 'function') {
          try {
            event.currentTarget.setPointerCapture(event.pointerId)
          } catch {
            /* capture is a nicety; the handlers still receive the moves */
          }
        }
        if (typeof event.preventDefault === 'function') event.preventDefault()
      }

      /** Follow the pointer, clamped into the viewport. */
      function moveDrag(event) {
        const drag = dragRef.current
        if (drag === null || drag.pointerId !== event.pointerId) return
        const dx = event.clientX - drag.startX
        const dy = event.clientY - drag.startY
        // A click should not nudge the card; three pixels of intent do.
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 3) return
        drag.moved = true
        setPosition(clampPosition(drag.originX + dx, drag.originY + dy, drag.width, drag.height))
        if (typeof event.preventDefault === 'function') event.preventDefault()
      }

      /** Finish the drag, keeping the new position only when the card moved. */
      function endDrag(event) {
        const drag = dragRef.current
        if (drag === null) return
        dragRef.current = null
        setDragging(false)
        if (event.currentTarget !== null && typeof event.currentTarget === 'object' && typeof event.currentTarget.releasePointerCapture === 'function') {
          try {
            event.currentTarget.releasePointerCapture(drag.pointerId)
          } catch {
            /* already released */
          }
        }
        if (drag.moved) savePosition(positionRef.current)
      }

      /** Return to the default corner and forget the dragged position. */
      function resetPosition() {
        dragRef.current = null
        setDragging(false)
        setPosition(null)
        savePosition(null)
      }

      /** Step the card through its opacity presets. */
      function cycleOpacity() {
        commitOpacity(nextOpacity(opacity))
      }

      // A dragged card follows the window when it shrinks; the default corner is
      // pure CSS and needs no help.
      React.useEffect(() => {
        function onResize() {
          const card = cardRef.current
          if (positionRef.current === null || card === null || typeof card !== 'object' || typeof card.getBoundingClientRect !== 'function') return
          const rect = card.getBoundingClientRect()
          setPosition((current) => (current === null ? current : clampPosition(current.x, current.y, rect.width, rect.height)))
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
      }, [])

      const surfaceStyle = { '--dwo-opacity': String(opacity) }
      if (position !== null) {
        surfaceStyle.left = position.x + 'px'
        surfaceStyle.top = position.y + 'px'
        surfaceStyle.right = 'auto'
        surfaceStyle.bottom = 'auto'
      }

      if (mode === 'pill') {
        return h(
          'div',
          { className: 'dwo-pill-shell' },
          h('style', null, CSS),
          h(
            'button',
            {
              type: 'button',
              className: 'dwo-pill' + (state.phase === 'before' ? ' is-idle' : ''),
              style: surfaceStyle,
              title: t('float.expand'),
              'aria-label': t('float.expand'),
              onClick: () => changeMode('card'),
            },
            h('span', { className: 'dwo-pill-mark' }, statusIcon(state.phase)),
            h('span', { className: 'dwo-pill-text' }, pillText(state)),
          ),
        )
      }

      return h(
        'div',
        {
          ref: cardRef,
          className: 'dwo-card dwo-float' + phaseClass(state) + (dragging ? ' is-dragging' : ''),
          style: surfaceStyle,
          onPointerDown: startDrag,
          onPointerMove: moveDrag,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
        },
        h('style', null, CSS),
        h(
          'div',
          { className: 'dwo-float-tools' },
          h(
            'button',
            { type: 'button', className: 'dwo-tool', title: t('float.open'), 'aria-label': t('float.open'), onClick: openPage },
            slidersIcon(),
          ),
          position === null
            ? null
            : h(
                'button',
                { type: 'button', className: 'dwo-tool', title: t('float.reset'), 'aria-label': t('float.reset'), onClick: resetPosition },
                targetIcon(),
              ),
          h(
            'button',
            {
              type: 'button',
              className: 'dwo-tool',
              title: tf('float.opacity', { value: opacityPercent(opacity) }),
              'aria-label': tf('float.opacity', { value: opacityPercent(opacity) }),
              onClick: cycleOpacity,
            },
            contrastIcon(),
          ),
          h(
            'button',
            { type: 'button', className: 'dwo-tool', title: t('float.fold'), 'aria-label': t('float.fold'), onClick: () => changeMode('pill') },
            foldIcon(),
          ),
        ),
        cardBody(state),
      )
    }

    /** The collapsed pill's text for one state. */
    function pillText(state) {
      if (state.phase === 'working') return remainingShort(state.remainingMs)
      if (state.phase === 'before') return tf('float.before', { time: state.endText })
      if (state.phase === 'rest') return t('card.rest')
      return t('card.off')
    }

    /**
     * Page chrome with theme tokens. The accent is the host's success token (it
     * turns green the moment the day is done); neutral surfaces and text stay on
     * the `--dsw-alias-*` tokens so light and dark themes both read correctly.
     */
    const CSS = `
.dwo-root{height:100%;box-sizing:border-box;overflow-y:auto;padding:34px 30px 56px;color:var(--dsw-alias-label-primary);}
.dwo-content{max-width:520px;margin:0 auto;}
.dwo-header{margin-bottom:18px;}
.dwo-title{margin:0;font-size:22px;font-weight:600;line-height:1.25;letter-spacing:.2px;}
.dwo-subtitle{margin:7px 0 0;font-size:12.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);}
.dwo-card{--dwo-accent:var(--dsw-alias-state-success-primary);display:flex;flex-direction:column;gap:14px;padding:22px 24px 18px;border:1px solid var(--dsw-alias-border-l1);border-radius:18px;background:var(--dsw-alias-bg-layer-1);box-shadow:0 1px 2px rgba(15,23,42,.05),0 20px 44px -34px rgba(15,23,42,.55);}
.dwo-card.is-idle{--dwo-accent:var(--dsw-alias-state-idle-primary);}
.dwo-status{display:flex;align-items:center;gap:8px;color:var(--dwo-accent);font-size:13px;font-weight:500;line-height:1;}
.dwo-status-mark{display:grid;place-items:center;width:18px;height:18px;flex:none;}
.dwo-status-mark svg{display:block;}
.dwo-headline{margin:2px 0 0;font-size:26px;font-weight:600;line-height:1.28;letter-spacing:.2px;color:var(--dwo-accent);font-variant-numeric:tabular-nums;overflow-wrap:anywhere;}
.dwo-track{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);overflow:hidden;}
.dwo-fill{height:100%;border-radius:999px;background:var(--dwo-accent);transition:width .4s ease;}
.dwo-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}
.dwo-foot-left{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.dwo-settings{display:flex;flex-direction:column;gap:13px;margin-top:18px;padding:17px 19px 16px;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-layer-1);}
.dwo-settings-head{display:flex;align-items:center;justify-content:space-between;gap:12px;}
.dwo-settings-title{margin:0;font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);}
.dwo-reset{padding:3px 8px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
.dwo-reset:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.dwo-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.dwo-field{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--dsw-alias-label-secondary);}
.dwo-field-label{font-size:12px;color:var(--dsw-alias-label-secondary);}
.dwo-time{box-sizing:border-box;height:29px;padding:0 7px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12.5px;font-variant-numeric:tabular-nums;cursor:pointer;}
.dwo-time:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dwo-days{display:flex;align-items:center;gap:6px;flex-wrap:wrap;}
.dwo-day{width:31px;height:27px;padding:0;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;cursor:pointer;}
.dwo-day:hover{border-color:var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary);}
.dwo-day.is-on{border-color:transparent;background:var(--dsw-alias-state-success-primary);color:#fff;}
.dwo-day:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dwo-range{width:140px;margin:0;cursor:pointer;accent-color:var(--dsw-alias-brand-primary);}
.dwo-range-value{min-width:38px;font-size:11.5px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums;}
.dwo-warn{margin:0;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-state-error-primary);}
.dwo-hint{margin:0;font-size:11.5px;line-height:1.5;color:var(--dsw-alias-label-secondary);}
.dwo-float{position:fixed;right:20px;bottom:20px;width:268px;max-width:calc(100vw - 32px);box-sizing:border-box;padding:14px 16px 12px;gap:9px;background:var(--dsw-alias-bg-overlay);pointer-events:auto;-webkit-app-region:no-drag;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none;opacity:var(--dwo-opacity,1);transition:opacity .18s ease;box-shadow:0 10px 34px -14px rgba(0,0,0,.38),0 1px 2px rgba(0,0,0,.08);}
.dwo-float:hover,.dwo-float:focus-within,.dwo-float.is-dragging{opacity:1;}
.dwo-float.is-dragging{cursor:grabbing;}
.dwo-float button{cursor:pointer;}
.dwo-float .dwo-status{font-size:12px;}
.dwo-float .dwo-headline{font-size:20px;line-height:1.3;}
.dwo-float .dwo-foot{font-size:11.5px;}
.dwo-float-tools{position:absolute;top:7px;right:7px;display:flex;gap:1px;opacity:0;transition:opacity .15s ease;}
.dwo-float:hover .dwo-float-tools,.dwo-float:focus-within .dwo-float-tools{opacity:1;}
.dwo-tool{display:grid;place-items:center;width:22px;height:22px;padding:0;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;}
.dwo-tool:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);}
.dwo-tool:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px;}
.dwo-pill{position:fixed;right:20px;bottom:20px;display:inline-flex;align-items:center;gap:7px;max-width:calc(100vw - 32px);padding:7px 12px 7px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:999px;background:var(--dsw-alias-bg-overlay);color:var(--dsw-alias-state-success-primary);font:inherit;font-size:12px;font-variant-numeric:tabular-nums;cursor:pointer;pointer-events:auto;-webkit-app-region:no-drag;opacity:var(--dwo-opacity,1);transition:opacity .18s ease;box-shadow:0 6px 20px -10px rgba(0,0,0,.35);}
.dwo-pill:hover,.dwo-pill:focus-visible{opacity:1;}
.dwo-pill:hover{color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-border-l2);}
.dwo-pill:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:2px;}
.dwo-pill.is-idle{color:var(--dsw-alias-state-idle-primary);}
.dwo-pill-mark{display:grid;place-items:center;width:16px;height:16px;flex:none;}
.dwo-pill-mark svg{display:block;}
.dwo-pill-text{white-space:nowrap;}
@media (max-width:640px){.dwo-root{padding:22px 16px 40px;}.dwo-headline{font-size:23px;}.dwo-float{right:12px;bottom:12px;width:calc(100vw - 24px);}}
@media (prefers-reduced-motion:reduce){.dwo-fill{transition:none;}.dwo-float,.dwo-pill{transition:none;}.dwo-float-tools{transition:none;}}
`

    // ------------------------------------------------------------- plugin

    /**
     * Mount the sidebar entry, the countdown page and the floating card.
     * @param {object} ctx - client root context (services: slots, layout, locale).
     */
    function apply(ctx) {
      const localeService = typeof ctx.get === 'function' ? ctx.get('locale') : undefined
      if (localeService !== undefined && localeService !== null) {
        locale = localeService
        try {
          const disposers = []
          if (typeof localeService.register === 'function') {
            disposers.push(localeService.register(NS, 'zh', zh))
            disposers.push(localeService.register(NS, 'en', en))
          }
          if (typeof localeService.bind === 'function') translate = localeService.bind(NS)
          if (disposers.length > 0) {
            ctx.effect(() => () => {
              for (const dispose of disposers.splice(0)) {
                try {
                  dispose()
                } catch {
                  /* already gone */
                }
              }
            }, 'off-work-countdown: dictionaries')
          }
        } catch (reason) {
          console.warn('[off-work-countdown] locale registration failed:', reason)
        }
      }

      const layoutService = typeof ctx.get === 'function' ? ctx.get('layout') : undefined
      if (layoutService !== undefined && layoutService !== null) layout = layoutService

      const slots = ctx.slots
      if (slots === undefined || slots === null) {
        console.warn('[off-work-countdown] slot service unavailable; the surfaces stay unmounted')
        return
      }

      // The shell owns the row (button, label, tooltip, rail); this only draws
      // the glyph. The page lives in the layout's keyed `main` slot under the
      // same id, so the shell's own panel switch reaches it.
      ctx.effect(
        () =>
          slots.inject('sidebar.panellist', () =>
            slots.register({ name: 'sidebar.panellist', id: PANEL_ID, order: PANEL_ORDER, label: () => t('entry.label') }, CountdownIcon),
          ),
        'off-work-countdown: sidebar entry',
      )

      ctx.effect(
        () => slots.inject('main', () => slots.register({ name: 'main', key: PANEL_ID }, OffWorkPage)),
        'off-work-countdown: page',
      )

      // The frame overlay layer is click-through; the card opts back into pointer
      // events, so it never blocks the workspace underneath it.
      ctx.effect(
        () =>
          slots.inject('shell.overlay', () =>
            slots.register({ name: 'shell.overlay', id: 'off-work-float', order: OVERLAY_ORDER, label: () => t('entry.label') }, FloatingCountdown),
          ),
        'off-work-countdown: floating card',
      )
    }

    return { inject: ['slots'], apply }
  },
})
