(() => {
  const getCurrentScheme = () => document.documentElement.getAttribute('data-dark-scheme') || 'gray'
  const getCurrentThemeMode = () => document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'

  const getDarkmodeButton = () => document.getElementById('darkmode')

  const setDarkmodeIconState = mode => {
    const button = getDarkmodeButton()
    if (!button) return

    const sun = button.querySelector('.darkmode-icon__sun')
    const moon = button.querySelector('.darkmode-icon__moon')
    if (!sun || !moon) return

    const isDark = mode === 'dark'
    setTimeout(() => {
      button.dataset.iconState = isDark ? 'dark' : 'light'
      sun.classList.toggle('hidden', isDark)
      moon.classList.toggle('hidden', !isDark)
      // sun.hidden = isDark
      // moon.hidden = !isDark
    }, 450)
  }

  const playDarkmodeIconAnimation = (trigger, nextMode) => {
    const button = trigger && trigger.id === 'darkmode' ? trigger : getDarkmodeButton()
    if (!button) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDarkmodeIconState(nextMode)
      return
    }

    if (button.dataset.animating === '1') return
    button.dataset.animating = '1'

    button.querySelectorAll('animate, animateTransform').forEach(element => {
      if (typeof element.beginElement === 'function') {
        try {
          element.beginElement()
        } catch (error) { }
      }
    })

    window.clearTimeout(button.__darkmodeIconTimer)
    button.__darkmodeIconTimer = window.setTimeout(() => {
      setDarkmodeIconState(nextMode)
      button.dataset.animating = '0'
    }, 490)
  }

  const syncDarkSchemeButtons = () => {
    const scheme = getCurrentScheme()
    document.querySelectorAll('.rightside-theme-palette__option[data-scheme]').forEach(button => {
      button.classList.toggle('is-active', button.dataset.scheme === scheme)
    })
  }

  const runThemeViewTransition = (trigger, callback) => {
    runClipPathViewTransition(trigger, callback, {
      duration: 520,
      easing: 'cubic-bezier(.4, 0, .2, 1)',
      mode: 'expand'
    })
  }

  const runClipPathViewTransition = (trigger, callback, options = {}) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || prefersReducedMotion) {
      callback()
      return Promise.resolve()
    }

    const {
      duration = 520,
      easing = 'cubic-bezier(.4, 0, .2, 1)',
      mode = 'expand'
    } = options

    const rect = trigger && typeof trigger.getBoundingClientRect === 'function'
      ? trigger.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 }

    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    )

    const transition = document.startViewTransition(() => {
      callback()
    })

    transition.ready.then(() => {
      const isCollapse = mode === 'collapse'
      document.documentElement.animate(
        {
          clipPath: isCollapse
            ? [
                `circle(${endRadius}px at ${x}px ${y}px)`,
                `circle(0px at ${x}px ${y}px)`
              ]
            : [
                `circle(0px at ${x}px ${y}px)`,
                `circle(${endRadius}px at ${x}px ${y}px)`
              ]
        },
        {
          duration,
          easing,
          pseudoElement: isCollapse ? '::view-transition-old(root)' : '::view-transition-new(root)'
        }
      )
    }).catch(() => {})

    return transition.finished.catch(() => {})
  }

  const runFloatingPanelTransition = (trigger, panel, backdrop, visible, options = {}) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canAnimate = panel && backdrop && typeof panel.animate === 'function' && typeof backdrop.animate === 'function'
    const {
      duration = visible ? 420 : 300,
      easing = visible ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.4,0,.2,1)',
      getBaseTransform = () => 'none'
    } = options

    const setVisibility = show => {
      panel.style.display = show ? 'block' : ''
      backdrop.style.display = show ? 'block' : ''
      if (!show) {
        panel.style.opacity = ''
        panel.style.transformOrigin = ''
        panel.style.willChange = ''
        backdrop.style.opacity = ''
        backdrop.style.willChange = ''
      }
    }

    if (!canAnimate || prefersReducedMotion) {
      setVisibility(visible)
      return Promise.resolve()
    }

    panel.getAnimations().forEach(animation => animation.cancel())
    backdrop.getAnimations().forEach(animation => animation.cancel())

    const triggerRect = trigger && typeof trigger.getBoundingClientRect === 'function'
      ? trigger.getBoundingClientRect()
      : { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 44, height: 44 }

    const baseTransform = getBaseTransform()

    if (visible) {
      setVisibility(true)
      panel.style.opacity = '0'
      backdrop.style.opacity = '0'
      panel.style.willChange = 'transform, opacity, filter'
      backdrop.style.willChange = 'opacity, backdrop-filter'

      const panelRect = panel.getBoundingClientRect()
      const triggerCenterX = triggerRect.left + triggerRect.width / 2
      const triggerCenterY = triggerRect.top + triggerRect.height / 2
      const originX = ((triggerCenterX - panelRect.left) / Math.max(panelRect.width, 1)) * 100
      const originY = ((triggerCenterY - panelRect.top) / Math.max(panelRect.height, 1)) * 100
      const scaleX = Math.max(0.08, Math.min(1, triggerRect.width / Math.max(panelRect.width, 1)))
      const scaleY = Math.max(0.08, Math.min(1, triggerRect.height / Math.max(panelRect.height, 1)))
      const startRadius = Math.max(triggerRect.width, triggerRect.height) / 2

      panel.style.transformOrigin = `${originX}% ${originY}%`

      const panelAnimation = panel.animate([
        {
          opacity: 0.18,
          transform: `${baseTransform} scale(${scaleX}, ${scaleY})`,
          filter: 'blur(10px)',
          borderRadius: `${startRadius}px`
        },
        {
          opacity: 1,
          transform: `${baseTransform} scale(1, 1)`,
          filter: 'blur(0px)',
          borderRadius: getComputedStyle(panel).borderRadius
        }
      ], {
        duration,
        easing,
        fill: 'forwards'
      })

      const backdropAnimation = backdrop.animate([
        {
          opacity: 0,
          backdropFilter: 'blur(0px) saturate(100%)'
        },
        {
          opacity: 1,
          backdropFilter: 'blur(16px) saturate(125%)'
        }
      ], {
        duration: Math.max(240, duration - 20),
        easing,
        fill: 'forwards'
      })

      return Promise.allSettled([panelAnimation.finished, backdropAnimation.finished]).finally(() => {
        panel.style.opacity = ''
        panel.style.transformOrigin = ''
        panel.style.willChange = ''
        backdrop.style.opacity = ''
        backdrop.style.willChange = ''
      })
    }

    const panelRect = panel.getBoundingClientRect()
    const triggerCenterX = triggerRect.left + triggerRect.width / 2
    const triggerCenterY = triggerRect.top + triggerRect.height / 2
    const originX = ((triggerCenterX - panelRect.left) / Math.max(panelRect.width, 1)) * 100
    const originY = ((triggerCenterY - panelRect.top) / Math.max(panelRect.height, 1)) * 100
    const scaleX = Math.max(0.08, Math.min(1, triggerRect.width / Math.max(panelRect.width, 1)))
    const scaleY = Math.max(0.08, Math.min(1, triggerRect.height / Math.max(panelRect.height, 1)))
    const endRadius = Math.max(triggerRect.width, triggerRect.height) / 2

    panel.style.transformOrigin = `${originX}% ${originY}%`
    panel.style.willChange = 'transform, opacity, filter'
    backdrop.style.willChange = 'opacity, backdrop-filter'

    const panelAnimation = panel.animate([
      {
        opacity: 1,
        transform: `${baseTransform} scale(1, 1)`,
        filter: 'blur(0px)',
        borderRadius: getComputedStyle(panel).borderRadius
      },
      {
        opacity: 0,
        transform: `${baseTransform} scale(${scaleX}, ${scaleY})`,
        filter: 'blur(10px)',
        borderRadius: `${endRadius}px`
      }
    ], {
      duration,
      easing,
      fill: 'forwards'
    })

    const backdropAnimation = backdrop.animate([
      {
        opacity: 1,
        backdropFilter: 'blur(16px) saturate(125%)'
      },
      {
        opacity: 0,
        backdropFilter: 'blur(0px) saturate(100%)'
      }
    ], {
      duration: Math.max(220, duration - 40),
      easing,
      fill: 'forwards'
    })

    return Promise.allSettled([panelAnimation.finished, backdropAnimation.finished]).finally(() => {
      setVisibility(false)
    })
  }

  const runSharedPanelViewTransition = (trigger, panel, backdrop, visible, options = {}) => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canUseViewTransition = Boolean(document.startViewTransition && !prefersReducedMotion && panel && backdrop)
    const {
      duration = visible ? 460 : 320,
      easing = visible ? 'cubic-bezier(.16,1,.3,1)' : 'cubic-bezier(.32,0,.2,1)',
      openClass = ''
    } = options

    const applyState = show => {
      if (show) {
        backdrop.style.display = 'block'
        panel.style.display = 'block'
        openClass && document.body.classList.add(openClass)
      } else {
        openClass && document.body.classList.remove(openClass)
        panel.style.display = ''
      }
    }

    if (!canUseViewTransition) {
      return runFloatingPanelTransition(trigger, panel, backdrop, visible, options)
    }

    panel.getAnimations().forEach(animation => animation.cancel())
    backdrop.getAnimations().forEach(animation => animation.cancel())

    const transition = document.startViewTransition(() => {
      applyState(visible)
    })

    return transition.ready.then(() => {
      const backdropAnimation = backdrop.animate([
        {
          opacity: visible ? 0 : 1,
          backdropFilter: visible ? 'blur(0px) saturate(100%)' : 'blur(16px) saturate(125%)'
        },
        {
          opacity: visible ? 1 : 0,
          backdropFilter: visible ? 'blur(16px) saturate(125%)' : 'blur(0px) saturate(100%)'
        }
      ], {
        duration,
        easing,
        fill: 'forwards'
      })

      return Promise.allSettled([
        transition.finished.catch(() => {}),
        backdropAnimation.finished.catch(() => {})
      ]).finally(() => {
        backdrop.style.opacity = ''
        backdrop.style.backdropFilter = ''
        backdrop.getAnimations().forEach(animation => animation.cancel())
        if (!visible) {
          backdrop.style.display = ''
        }
      })
    }).catch(() => {
      if (!visible) {
        backdrop.style.display = ''
      }
    })
  }

  const applyDarkScheme = scheme => {
    if (window.btf && typeof btf.applyDarkScheme === 'function') {
      btf.applyDarkScheme(scheme)
    } else {
      document.documentElement.setAttribute('data-dark-scheme', scheme === 'black' ? 'black' : 'gray')
    }

    if (window.btf && btf.saveToLocal) {
      btf.saveToLocal.set('dark-scheme', scheme === 'black' ? 'black' : 'gray', 3650)
    }
    syncDarkSchemeButtons()
  }

  const toggleThemeMode = trigger => {
    const willChangeMode = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'

    playDarkmodeIconAnimation(trigger, willChangeMode)

    const applyTheme = () => {
      if (willChangeMode === 'dark') {
        btf.activateDarkMode()
        GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.day_to_night)
      } else {
        btf.activateLightMode()
        GLOBAL_CONFIG.Snackbar !== undefined && btf.snackbarShow(GLOBAL_CONFIG.Snackbar.night_to_day)
      }

      btf.saveToLocal.set('theme', willChangeMode, 2)

      const globalFn = window.globalFn || {}
      const themeChange = globalFn.themeChange || {}
      Object.keys(themeChange).forEach(key => {
        const themeChangeFn = themeChange[key]
        if (['disqus', 'disqusjs'].includes(key)) {
          setTimeout(() => themeChangeFn(willChangeMode), 300)
        } else {
          themeChangeFn(willChangeMode)
        }
      })

      syncDarkSchemeButtons()
      setDarkmodeIconState(willChangeMode)
    }

    runThemeViewTransition(trigger, applyTheme)
  }

  const init = () => {
    syncDarkSchemeButtons()
    setDarkmodeIconState(getCurrentThemeMode())
  }

  window.woisolTheme = {
    applyDarkScheme,
    getCurrentScheme,
    init,
    runFloatingPanelTransition,
    runClipPathViewTransition,
    runSharedPanelViewTransition,
    runThemeViewTransition,
    syncDarkSchemeButtons,
    toggleThemeMode
  }
})()
