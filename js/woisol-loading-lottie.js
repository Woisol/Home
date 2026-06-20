(() => {
  const state = {
    animation: null,
    currentPath: '',
    themeObserver: null,
    mediaQuery: null,
    failedPath: ''
  }

  const supportsLottie = () => Boolean(window.lottie && typeof window.lottie.loadAnimation === 'function')

  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const getBox = () => document.getElementById('loading-box')

  const getContainer = () => document.querySelector('[data-loading-lottie]')

  const getThemeMode = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'

  const getAnimationPath = box => {
    if (!box) return ''
    return getThemeMode() === 'dark'
      ? (box.dataset.loadingLottieDark || '')
      : (box.dataset.loadingLottieLight || '')
  }

  const setReady = ready => {
    const container = getContainer()
    if (!container) return
    container.classList.toggle('is-ready', ready)
  }

  const removeFallback = () => {
    const container = getContainer()
    const fallback = container && container.querySelector('.loading-box__hero-fallback')
    fallback && fallback.remove()
  }

  const destroyAnimation = ({ preserveFailedPath = false } = {}) => {
    if (state.animation) {
      state.animation.destroy()
      state.animation = null
    }
    state.currentPath = ''
    if (!preserveFailedPath) {
      state.failedPath = ''
    }
    setReady(false)
  }

  const pauseAnimation = () => {
    if (state.animation && typeof state.animation.pause === 'function') {
      state.animation.pause()
    }
  }

  const playAnimation = () => {
    if (state.animation && typeof state.animation.play === 'function') {
      state.animation.play()
    }
  }

  const ensureAnimation = forceReload => {
    const box = getBox()
    const container = getContainer()
    if (!box || !container) return

    if (prefersReducedMotion() || !supportsLottie()) {
      box.dataset.loadingMotion = 'reduced'
      destroyAnimation()
      return
    }

    const nextPath = getAnimationPath(box)
    if (!nextPath) return

    box.dataset.loadingMotion = 'animated'

    if (!forceReload && state.failedPath === nextPath) {
      return
    }

    if (!forceReload && state.animation && state.currentPath === nextPath) {
      return
    }

    destroyAnimation()
    state.currentPath = nextPath
    state.animation = window.lottie.loadAnimation({
      container,
      renderer: 'svg',
      loop: true,
      autoplay: box.dataset.state !== 'done',
      path: nextPath,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
        progressiveLoad: true,
        hideOnTransparent: true
      }
    })

    if (typeof state.animation.setSubframe === 'function') {
      state.animation.setSubframe(false)
    }

    state.animation.addEventListener('DOMLoaded', () => {
      removeFallback()
      setReady(true)
    })

    state.animation.addEventListener('data_failed', () => {
      state.failedPath = nextPath
      box.dataset.loadingMotion = 'fallback'
      destroyAnimation({ preserveFailedPath: true })
    })
  }

  const syncPlayback = forceReload => {
    const box = getBox()
    if (!box) return

    ensureAnimation(forceReload)
    if (!state.animation) return

    if (box.dataset.state === 'done') {
      pauseAnimation()
    } else {
      playAnimation()
    }
  }

  const observeTheme = () => {
    if (state.themeObserver) return
    state.themeObserver = new MutationObserver(records => {
      const changedTheme = records.some(record => record.attributeName === 'data-theme')
      if (changedTheme) syncPlayback(true)
    })
    state.themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    })
  }

  const bindMotionPreference = () => {
    if (state.mediaQuery) return
    state.mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => syncPlayback(true)
    if (typeof state.mediaQuery.addEventListener === 'function') {
      state.mediaQuery.addEventListener('change', onChange)
    } else if (typeof state.mediaQuery.addListener === 'function') {
      state.mediaQuery.addListener(onChange)
    }
  }

  const init = () => {
    if (!getBox() || !getContainer()) return

    syncPlayback(false)
    observeTheme()
    bindMotionPreference()

    window.addEventListener('woisol:loading-started', () => {
      syncPlayback(false)
    })

    window.addEventListener('woisol:loading-finished', () => {
      pauseAnimation()
    })

    if (window.btf && typeof btf.addGlobalFn === 'function') {
      btf.addGlobalFn('themeChange', () => syncPlayback(true), 'woisol-loading-lottie-theme')
      btf.addGlobalFn('pjaxSend', () => syncPlayback(false), 'woisol-loading-lottie-pjax')
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }
})()
