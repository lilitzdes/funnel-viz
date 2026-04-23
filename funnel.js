// Looker Studio Community Visualization — Funnel Chart Pro
// Поддерживает: 1-2 параметра, до 15 метрик, % от первой и предыдущей

(function() {

  const dscc = require('@google/dscc');
  const local = require('./local');

  // Используем локальный режим при разработке
  const IS_LOCAL = typeof local !== 'undefined';

  function drawViz(data) {
    // Очищаем контейнер
    const container = document.getElementById('funnel-container');
    if (!container) {
      const div = document.createElement('div');
      div.id = 'funnel-container';
      document.body.appendChild(div);
    }
    document.getElementById('funnel-container').innerHTML = '';

    const style = data.style;
    const funnelColor = style.funnelColor && style.funnelColor.value
      ? style.funnelColor.value.color
      : '#4285F4';
    const fontColor = style.fontColor && style.fontColor.value
      ? style.fontColor.value.color
      : '#212121';
    const showPctFromFirst = style.showPctFromFirst
      ? style.showPctFromFirst.value
      : true;
    const showPctFromPrev = style.showPctFromPrev
      ? style.showPctFromPrev.value
      : true;

    const fields = data.fields;
    const metricFields = fields.metric || [];
    const dimFields = fields.dimension || [];

    const rows = data.tables.DEFAULT;
    if (!rows || rows.length === 0) {
      document.getElementById('funnel-container').innerHTML =
        '<p style="color:#999;padding:20px;">Нет данных</p>';
      return;
    }

    // Группируем по параметру (если есть)
    // Для воронки суммируем метрики по всем строкам
    const metricTotals = metricFields.map((_, mi) => {
      return rows.reduce((sum, row) => {
        const val = row.metric[mi];
        return sum + (typeof val === 'number' ? val : 0);
      }, 0);
    });

    const metricNames = metricFields.map(f => f.name || f.id);
    const maxVal = metricTotals[0] || 1;

    // Строим HTML воронки
    const containerEl = document.getElementById('funnel-container');
    containerEl.style.cssText = `
      font-family: 'Google Sans', Arial, sans-serif;
      padding: 12px;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      overflow-y: auto;
      color: ${fontColor};
    `;

    const totalWidth = containerEl.offsetWidth || 400;
    const barMaxWidth = Math.min(totalWidth - 180, 400);

    metricTotals.forEach((val, i) => {
      const pctFromFirst = maxVal > 0 ? (val / maxVal * 100).toFixed(1) : '0.0';
      const prevVal = i > 0 ? metricTotals[i - 1] : val;
      const pctFromPrev = prevVal > 0 ? (val / prevVal * 100).toFixed(1) : '0.0';
      const barWidth = maxVal > 0 ? (val / maxVal * barMaxWidth) : 0;

      // Цвет с градиентом по шагам
      const alpha = 1 - (i * 0.05);
      const stepColor = hexToRgba(funnelColor, Math.max(alpha, 0.3));

      const row = document.createElement('div');
      row.style.cssText = `
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        gap: 8px;
      `;

      // Название метрики
      const nameEl = document.createElement('div');
      nameEl.style.cssText = `
        width: 130px;
        min-width: 130px;
        font-size: 12px;
        text-align: right;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: ${fontColor};
      `;
      nameEl.title = metricNames[i];
      nameEl.textContent = metricNames[i];

      // Бар
      const barWrap = document.createElement('div');
      barWrap.style.cssText = `
        flex: 1;
        position: relative;
        height: 32px;
      `;

      const bar = document.createElement('div');
      bar.style.cssText = `
        height: 32px;
        width: ${barWidth}px;
        background: ${stepColor};
        border-radius: 3px;
        display: flex;
        align-items: center;
        padding-left: 8px;
        box-sizing: border-box;
        transition: width 0.3s ease;
      `;

      // Значение на баре
      const valLabel = document.createElement('span');
      valLabel.style.cssText = `
        font-size: 13px;
        font-weight: 600;
        color: white;
        white-space: nowrap;
      `;
      valLabel.textContent = formatNumber(val);
      bar.appendChild(valLabel);
      barWrap.appendChild(bar);

      // Проценты справа
      const pctEl = document.createElement('div');
      pctEl.style.cssText = `
        min-width: 110px;
        font-size: 11px;
        color: ${fontColor};
        opacity: 0.8;
        display: flex;
        flex-direction: column;
        gap: 1px;
      `;

      if (showPctFromFirst) {
        const p1 = document.createElement('span');
        p1.style.color = '#1a73e8';
        p1.textContent = `▶ от 1-й: ${pctFromFirst}%`;
        pctEl.appendChild(p1);
      }
      if (showPctFromPrev && i > 0) {
        const p2 = document.createElement('span');
        p2.style.color = '#34a853';
        p2.textContent = `↳ от пред.: ${pctFromPrev}%`;
        pctEl.appendChild(p2);
      }

      row.appendChild(nameEl);
      row.appendChild(barWrap);
      row.appendChild(pctEl);
      containerEl.appendChild(row);
    });

    // Если есть параметр — показываем разбивку по параметру ниже
    if (dimFields.length > 0 && rows.length > 1) {
      const sep = document.createElement('hr');
      sep.style.cssText = 'border:none;border-top:1px solid #e0e0e0;margin:16px 0;';
      containerEl.appendChild(sep);

      const dimLabel = document.createElement('div');
      dimLabel.style.cssText = `font-size:11px;color:#999;margin-bottom:8px;`;
      dimLabel.textContent = `Разбивка по параметру: ${dimFields[0].name}`;
      containerEl.appendChild(dimLabel);

      // Группируем строки по первому параметру
      const groups = {};
      rows.forEach(row => {
        const key = row.dimension[0] || '(нет)';
        if (!groups[key]) groups[key] = Array(metricFields.length).fill(0);
        metricFields.forEach((_, mi) => {
          const v = row.metric[mi];
          groups[key][mi] += typeof v === 'number' ? v : 0;
        });
      });

      Object.entries(groups).slice(0, 20).forEach(([dimVal, vals]) => {
        const groupTitle = document.createElement('div');
        groupTitle.style.cssText = `font-size:12px;font-weight:600;margin:8px 0 4px;`;
        groupTitle.textContent = dimVal;
        containerEl.appendChild(groupTitle);

        const gMax = vals[0] || 1;
        vals.forEach((v, i) => {
          const gPctFirst = gMax > 0 ? (v / gMax * 100).toFixed(1) : '0.0';
          const gPrev = i > 0 ? vals[i-1] : v;
          const gPctPrev = gPrev > 0 ? (v / gPrev * 100).toFixed(1) : '0.0';
          const gBarW = gMax > 0 ? (v / gMax * barMaxWidth * 0.7) : 0;
          const alpha = 1 - (i * 0.05);
          const stepColor = hexToRgba(funnelColor, Math.max(alpha, 0.3));

          const gRow = document.createElement('div');
          gRow.style.cssText = `display:flex;align-items:center;margin-bottom:4px;gap:8px;`;

          const gName = document.createElement('div');
          gName.style.cssText = `width:130px;min-width:130px;font-size:11px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
          gName.textContent = metricNames[i];

          const gBar = document.createElement('div');
          gBar.style.cssText = `height:22px;width:${gBarW}px;background:${stepColor};border-radius:2px;display:flex;align-items:center;padding-left:6px;box-sizing:border-box;`;

          const gVal = document.createElement('span');
          gVal.style.cssText = `font-size:11px;font-weight:600;color:white;white-space:nowrap;`;
          gVal.textContent = formatNumber(v);
          gBar.appendChild(gVal);

          const gPct = document.createElement('div');
          gPct.style.cssText = `min-width:110px;font-size:10px;opacity:0.8;display:flex;flex-direction:column;gap:1px;`;
          if (showPctFromFirst) {
            const p1 = document.createElement('span');
            p1.style.color='#1a73e8';
            p1.textContent=`▶ ${gPctFirst}%`;
            gPct.appendChild(p1);
          }
          if (showPctFromPrev && i > 0) {
            const p2 = document.createElement('span');
            p2.style.color='#34a853';
            p2.textContent=`↳ ${gPctPrev}%`;
            gPct.appendChild(p2);
          }

          gRow.appendChild(gName);
          gRow.appendChild(gBar);
          gRow.appendChild(gPct);
          containerEl.appendChild(gRow);
        });
      });
    }
  }

  function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return Math.round(n).toLocaleString('ru-RU');
  }

  function hexToRgba(hex, alpha) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(66,133,244,${alpha})`;
    return `rgba(${parseInt(result[1],16)},${parseInt(result[2],16)},${parseInt(result[3],16)},${alpha})`;
  }

  dscc.subscribeToData(drawViz, { transform: dscc.objectTransform });

})();
