
function getCurrentLocale() {
    var urlLang = new URLSearchParams(window.location.search).get('lang');
    return (typeof i18n !== 'undefined' && typeof i18n.getCurrentLanguage === 'function' ? i18n.getCurrentLanguage() : null) || urlLang || 'en';
}

function getShareUrl() {
    return 'https://dopabrain.com/name-match/?lang=' + encodeURIComponent(getCurrentLocale()) + '&utm_source=share';
}

function showToast(msg) {
    let toast = document.getElementById('nm-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'nm-toast';
        toast.className = 'nm-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2200);
}

function preserveLanguageLinks() {
    var currentLang = getCurrentLocale();
    var links = document.querySelectorAll('a[href^="/"], .related-card, .app-footer a');
    var base = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : 'https://dopabrain.com';
    links.forEach(function(link) {
        var href = link.getAttribute('data-base-href') || link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('#')) return;
        try {
            var url = new URL(href, base);
            url.searchParams.set('lang', currentLang);
            if (link.classList.contains('related-card') && !url.searchParams.has('source')) {
                url.searchParams.set('source', 'name_match_result');
            }
            link.setAttribute('href', url.pathname + url.search + url.hash);
            if (link.classList.contains('related-card') && !link.dataset.trackedCta) {
                link.dataset.trackedCta = 'true';
                link.addEventListener('click', function() {
                    if (typeof gtag === 'function') {
                        gtag('event', 'content_cta_click', {
                            cta_surface: 'name_match_related',
                            destination: link.getAttribute('href'),
                            source: 'name_match',
                            lang: currentLang
                        });
                    }
                });
            }
        } catch(e) {}
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preserveLanguageLinks);
} else {
    preserveLanguageLinks();
}

// Name Compatibility Test - Main App
const _t = (k, fb) => {
    const val = window.i18n?.t?.(k);
    return val && val !== k ? val : fb;
};
const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const mainScreen = document.getElementById('main-screen');
const loadingScreen = document.getElementById('loading-screen');
const resultScreen = document.getElementById('result-screen');
const name1Input = document.getElementById('name1');
const name2Input = document.getElementById('name2');
const btnCalc = document.getElementById('btn-calculate');

// i18n init
(async function initI18n() {
    try {
        await i18n.loadTranslations(i18n.getCurrentLanguage());
        i18n.updateUI();
        preserveLanguageLinks();
        const langToggle = document.getElementById('lang-toggle');
        const langMenu = document.getElementById('lang-menu');
        document.querySelector(`[data-lang="${i18n.getCurrentLanguage()}"]`)?.classList.add('active');
        langToggle?.addEventListener('click', () => langMenu.classList.toggle('hidden'));
        document.addEventListener('click', e => {
            if (!e.target.closest('.language-selector')) langMenu?.classList.add('hidden');
        });
        document.querySelectorAll('.lang-option').forEach(opt => {
            opt.addEventListener('click', async () => {
                await i18n.setLanguage(opt.dataset.lang);
                preserveLanguageLinks();
                document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                langMenu.classList.add('hidden');
            });
        });
    } catch (e) { console.warn('i18n init:', e); }
    finally {
        const loader = document.getElementById('app-loader');
        if (loader) { loader.classList.add('hidden');
          preserveLanguageLinks(); setTimeout(() => loader.remove(), 300); }
    }
})();

// Enable button when both names filled
function checkInputs() {
    const ok = name1Input.value.trim().length > 0 && name2Input.value.trim().length > 0;
    btnCalc.classList.toggle('enabled', ok);
    btnCalc.disabled = !ok;
}
name1Input.addEventListener('input', checkInputs);
name2Input.addEventListener('input', checkInputs);

// Enter key support
[name1Input, name2Input].forEach(input => {
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !btnCalc.disabled) btnCalc.click();
    });
});

// Calculate
btnCalc.addEventListener('click', () => {
    const n1 = name1Input.value.trim();
    const n2 = name2Input.value.trim();
    if (!n1 || !n2) return;
    showLoading(n1, n2);
    if (typeof gtag === 'function') {
        gtag('event', 'test_start', {
            event_category: 'name_match',
            app_name: 'name-match'
        });
    }
});

function show(screen) {
    [mainScreen, loadingScreen, resultScreen].forEach(s => s.classList.remove('active'));
    screen.classList.add('active');
    window.scrollTo(0, 0);
}

// Hash function for deterministic results
function hashNames(a, b) {
    // Normalize: sort alphabetically so order doesn't matter much
    const s = (a + '♥' + b).toLowerCase().normalize('NFC');
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    }
    return h;
}

// Seeded random from hash
function seededRand(seed) {
    let s = seed;
    return function() {
        s = (s * 1664525 + 1013904223) | 0;
        return (s >>> 0) / 4294967296;
    };
}

function calculateCompatibility(n1, n2) {
    const h = hashNames(n1, n2);
    const rand = seededRand(h);

    // 5 categories: love, friendship, chemistry, communication, future
    const cats = [];
    for (let i = 0; i < 5; i++) {
        cats.push(Math.floor(rand() * 51) + 50); // 50-100
    }

    // Boost: if names share characters, add bonus
    const set1 = new Set(n1.toLowerCase());
    const set2 = new Set(n2.toLowerCase());
    let shared = 0;
    set1.forEach(c => { if (set2.has(c)) shared++; });
    const bonus = Math.min(shared * 3, 15);
    cats[0] = Math.min(99, cats[0] + bonus); // love boost

    // Overall = weighted average
    const weights = [0.3, 0.2, 0.2, 0.15, 0.15];
    const overall = Math.round(cats.reduce((sum, v, i) => sum + v * weights[i], 0));

    return { overall, cats, names: [n1, n2] };
}

function showLoading(n1, n2) {
    show(loadingScreen);
    const bar = document.getElementById('loading-fill');
    const text = document.getElementById('loading-text');
    let progress = 0;

    const messages = [
        _t('loading.msg1', 'Analyzing name energy...'),
        _t('loading.msg2', 'Calculating compatibility...'),
        _t('loading.msg3', 'Measuring chemistry...'),
        _t('loading.msg4', 'Reading destiny patterns...'),
        _t('loading.msg5', 'Finalizing results...')
    ];

    if (prefersReducedMotion) {
        bar.style.width = '100%';
        text.textContent = messages[messages.length - 1];
        setTimeout(() => showResult(calculateCompatibility(n1, n2)), 40);
        return;
    }

    const interval = setInterval(() => {
        progress += Math.random() * 18 + 8;
        if (progress >= 100) {
            progress = 100;
            bar.style.width = '100%';
            clearInterval(interval);
            setTimeout(() => showResult(calculateCompatibility(n1, n2)), 400);
        } else {
            bar.style.width = progress + '%';
        }
        const idx = Math.min(Math.floor(progress / 20), messages.length - 1);
        text.textContent = messages[idx];
    }, 350);
}

function showResult(data) {
    show(resultScreen);

    // Names display
    document.getElementById('result-names').innerHTML =
        `<span class="name">${escHtml(data.names[0])}</span><span class="heart">💗</span><span class="name">${escHtml(data.names[1])}</span>`;

    // Score animation
    const scoreEl = document.getElementById('score-number');
    const ring = document.getElementById('score-ring');
    let current = 0;
    const target = data.overall;
    const circumference = 534;

    if (prefersReducedMotion) {
        scoreEl.textContent = target;
        ring.style.strokeDashoffset = circumference - (circumference * target / 100);
    } else {
        const anim = setInterval(() => {
            current += 2;
            if (current >= target) { current = target; clearInterval(anim); }
            scoreEl.textContent = current;
            ring.style.strokeDashoffset = circumference - (circumference * current / 100);
        }, 20);
    }

    // Score color based on value
    const color = target >= 85 ? '#ff4d6d' : target >= 70 ? '#ff8fa3' : target >= 55 ? '#ffa94d' : '#adb5bd';
    ring.style.stroke = color;

    // Label & description
    const { tierKey, label, desc } = getScoreText(target);
    document.getElementById('score-label').textContent = label;
    document.getElementById('score-desc').textContent = desc;

    // Categories
    const catNames = [
        _t('cat.love', 'Love'),
        _t('cat.friendship', 'Friendship'),
        _t('cat.chemistry', 'Chemistry'),
        _t('cat.communication', 'Communication'),
        _t('cat.future', 'Future')
    ];
    const catEmojis = ['❤️', '🤝', '⚡', '💬', '🔮'];
    const catsEl = document.getElementById('categories');
    catsEl.innerHTML = '';

    data.cats.forEach((score, i) => {
        const div = document.createElement('div');
        div.className = 'cat-item';
        div.innerHTML = `
            <div class="cat-header">
                <span class="cat-name">${catEmojis[i]} ${catNames[i]}</span>
                <span class="cat-score">${score}%</span>
            </div>
            <div class="cat-bar"><div class="cat-bar-fill" data-width="${score}"></div></div>`;
        catsEl.appendChild(div);
    });

    // Animate bars
    setTimeout(() => {
        catsEl.querySelectorAll('.cat-bar-fill').forEach(bar => {
            bar.style.width = bar.dataset.width + '%';
        });
    }, 100);

    // Advice
    const adviceBox = document.getElementById('advice-box');
    const advice = getAdvice(target);
    adviceBox.innerHTML = `<h3>💡 ${_t('result.adviceTitle', 'Relationship Advice')}</h3><p>${advice}</p>`;

    lastResultSnapshot = { data, tierKey, label, catNames, catEmojis };
    renderCuratedResources(tierKey);
    preserveLanguageLinks();

    if (typeof gtag === 'function') {
        gtag('event', 'test_complete', {
            event_category: 'name_match',
            app_name: 'name-match',
            result_type: tierKey
        });
    }
}

let lastResultSnapshot = null;

function getAmazonDomain(lang) {
    const map = { ja: 'amazon.co.jp', de: 'amazon.de', fr: 'amazon.fr', es: 'amazon.es', hi: 'amazon.in' };
    return map[lang] || 'amazon.com';
}

function renderCuratedResources(tierKey) {
    const container = document.getElementById('curated-resources-card');
    if (!container) return;
    const lang = getCurrentLocale();
    const domain = getAmazonDomain(lang);
    const items = [
        {
            key: 'sevenPrinciples',
            asin: '0553447718',
            title: _t('curated.gottmanTitle', 'The Seven Principles for Making Marriage Work'),
            desc: _t('curated.gottmanDesc', 'Research-backed habits that deepen friendship and conflict repair.')
        },
        {
            key: 'fiveLoveLanguages',
            asin: '080241270X',
            title: _t('curated.chapmanTitle', 'The 5 Love Languages — Gary Chapman'),
            desc: _t('curated.chapmanDesc', 'Discover how you and your partner naturally give and receive emotional affection.')
        }
    ];

    container.innerHTML = `
        <div class="curated-resources-header">
            <h3 class="curated-resources-title">${_t('curated.title', 'Recommended Relationship Guides')}</h3>
            <span class="curated-disclosure">${_t('curated.disclosure', 'Affiliate links')}</span>
        </div>
        <p class="curated-resources-subtitle">${_t('curated.subtitle', 'Go beyond names and strengthen everyday communication and trust.')}</p>
        <div class="curated-list">
            ${items.map(item => `
                <a class="curated-item" href="https://www.${domain}/dp/${item.asin}?tag=dopabrain-20" target="_blank" rel="noopener sponsored nofollow" data-resource-key="${item.key}">
                    <div class="curated-item-top">
                        <span class="curated-item-title">${item.title}</span>
                        <span class="curated-item-cta">${_t('curated.cta', 'View Book ->')}</span>
                    </div>
                    <span class="curated-item-desc">${item.desc}</span>
                </a>
            `).join('')}
        </div>`;

    container.querySelectorAll('.curated-item').forEach(link => {
        link.addEventListener('click', () => {
            if (typeof gtag === 'function') {
                gtag('event', 'curated_resource_click', {
                    app_name: 'name-match',
                    resource_key: link.getAttribute('data-resource-key'),
                    result_type: tierKey || '',
                    content_locale: lang,
                    cta_surface: 'curated_resources'
                });
                gtag('event', 'content_cta_click', {
                    cta_type: 'curated_book',
                    destination: link.getAttribute('href'),
                    source: 'name_match'
                });
            }
        });
    });
}

function saveMatchCard() {
    const canvas = document.getElementById('share-canvas');
    if (!canvas || !lastResultSnapshot) return;
    const { data, tierKey, label, catNames, catEmojis } = lastResultSnapshot;
    const lang = getCurrentLocale();
    const ctx = canvas.getContext('2d');
    canvas.width = 1080;
    canvas.height = 1920;

    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#1b0816');
    grad.addColorStop(0.5, '#330c24');
    grad.addColorStop(1, '#0e0a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = 'rgba(255, 77, 109, 0.16)';
    ctx.beginPath();
    ctx.arc(540, 500, 320, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ff8fa3';
    ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DOPABRAIN · NAME MATCH', 540, 170);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
    ctx.fillText(data.names[0] + '  💗  ' + data.names[1], 540, 300);

    ctx.fillStyle = '#ff4d6d';
    ctx.font = 'bold 168px system-ui, -apple-system, sans-serif';
    ctx.fillText(data.overall + '%', 540, 560);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 60px system-ui, -apple-system, sans-serif';
    ctx.fillText(label, 540, 680);

    data.cats.forEach((score, i) => {
        const y = 860 + i * 155;
        ctx.textAlign = 'left';
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 34px system-ui, -apple-system, sans-serif';
        ctx.fillText(catEmojis[i] + '  ' + catNames[i], 120, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ff8fa3';
        ctx.fillText(score + '%', 960, y);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(120, y + 24, 840, 28);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(120, y + 24, Math.round((score / 100) * 840), 28);
    });

    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '30px system-ui, -apple-system, sans-serif';
    ctx.fillText('dopabrain.com/name-match/?lang=' + lang, 540, 1780);

    try {
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = 'name-match-' + tierKey + '.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        showToast(_t('result.saved', 'Card Saved!'));
        if (typeof gtag === 'function') {
            gtag('event', 'save_image', {
                event_category: 'name_match',
                app_name: 'name-match',
                result_type: tierKey,
                save_surface: 'result_story_1080x1920'
            });
        }
    } catch (e) {
        showToast(_t('result.saveFailed', 'Could not save card.'));
    }
}

function getScoreText(score) {
    if (score >= 90) return {
        tierKey: 'soulmate',
        label: _t('level.soulmate', 'Soulmate Level!'),
        desc: _t('level.soulmateDesc', 'An extraordinary connection! Your names resonate on the deepest level. This is a rare and powerful bond that transcends the ordinary.')
    };
    if (score >= 80) return {
        tierKey: 'perfect',
        label: _t('level.perfect', 'Perfect Match!'),
        desc: _t('level.perfectDesc', 'Your compatibility is outstanding! The energy between your names creates a beautiful harmony. You complement each other naturally.')
    };
    if (score >= 70) return {
        tierKey: 'great',
        label: _t('level.great', 'Great Chemistry!'),
        desc: _t('level.greatDesc', 'There is a strong connection between you two. With some understanding and effort, this can become something truly special.')
    };
    if (score >= 60) return {
        tierKey: 'good',
        label: _t('level.good', 'Good Potential'),
        desc: _t('level.goodDesc', 'A solid foundation exists between your names. With patience and communication, this relationship can grow into something meaningful.')
    };
    if (score >= 50) return {
        tierKey: 'interesting',
        label: _t('level.interesting', 'Interesting Dynamic'),
        desc: _t('level.interestingDesc', 'Your names create an intriguing dynamic. While different, these differences can be complementary. Embrace what makes you unique together.')
    };
    return {
        tierKey: 'growing',
        label: _t('level.growing', 'Room to Grow'),
        desc: _t('level.growingDesc', 'Every great relationship starts somewhere! Your names suggest there is much to discover about each other. The journey itself is the reward.')
    };
}

function getAdvice(score) {
    if (score >= 85) return _t('advice.high', 'Your connection is naturally strong. Focus on maintaining open communication and never take each other for granted. Plan regular quality time together to keep the spark alive.');
    if (score >= 70) return _t('advice.medium', 'You have great potential together! Try to understand each other\'s love language and make small gestures of appreciation daily. Shared activities can strengthen your bond.');
    if (score >= 55) return _t('advice.low', 'Focus on building trust through honest communication. Find common interests and create shared experiences. Remember that the best relationships are built on effort and understanding.');
    return _t('advice.growing', 'Every connection has its own beauty. Focus on being your authentic self and showing genuine interest in the other person. Great relationships often surprise us when we least expect it.');
}

function escHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Share
document.getElementById('btn-share').addEventListener('click', () => {
    const n1 = name1Input.value.trim();
    const n2 = name2Input.value.trim();
    const data = calculateCompatibility(n1, n2);
    const text = _t('share.text', 'Our name compatibility is {score}%! 💕\n{name1} ♥ {name2}\nCheck yours too!')
        .replace('{score}', data.overall)
        .replace('{name1}', n1)
        .replace('{name2}', n2);
    const url = getShareUrl();

    if (navigator.share) {
        navigator.share({ title: _t('share.title', 'Name Compatibility Test'), text, url }).catch(() => {});
        if (typeof gtag === 'function') gtag('event', 'share', { event_category: 'name_match', method: 'web_share' });
    } else {
        navigator.clipboard.writeText(text + '\n' + url)
            .then(() => showToast(_t('share.copied', 'Copied to clipboard!')))
            .catch(() => {});
        if (typeof gtag === 'function') gtag('event', 'share', { event_category: 'name_match', method: 'copy' });
    }
});

document.getElementById('btn-save-card')?.addEventListener('click', saveMatchCard);

// Retry
document.getElementById('btn-retry').addEventListener('click', () => {
    name1Input.value = '';
    name2Input.value = '';
    checkInputs();
    show(mainScreen);
    name1Input.focus();
});

// Theme
const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.textContent = saved === 'light' ? '🌙' : '☀️';
    themeToggle.addEventListener('click', () => {
        const cur = document.documentElement.getAttribute('data-theme');
        const next = cur === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeToggle.textContent = next === 'light' ? '🌙' : '☀️';
    });
}
