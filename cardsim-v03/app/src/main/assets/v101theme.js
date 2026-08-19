'use strict';

/* V1.0.1 — keep grading/progression on the same VOX dark palette as the rest of the app. */
const v101ThemeStyle=document.createElement('style');
v101ThemeStyle.textContent=`
#v100ProgressionModal .modal-card,
#v100GradingCenter .modal-card,
#v100GradingSubmitModal .modal-card{color:#f4f7fb;background:#0f1721;border-color:#2b3849}
#v100ProgressionModal h2,#v100ProgressionModal h3,#v100ProgressionModal strong,
#v100GradingCenter h2,#v100GradingCenter h3,#v100GradingCenter strong,
#v100GradingSubmitModal h2,#v100GradingSubmitModal h3,#v100GradingSubmitModal strong{color:#f4f7fb}
#v100ProgressionModal p,#v100ProgressionModal small,#v100ProgressionModal span,
#v100GradingCenter p,#v100GradingCenter small,#v100GradingCenter span,
#v100GradingSubmitModal p,#v100GradingSubmitModal small,#v100GradingSubmitModal span{color:#9eabbb}
#v100ProgressionModal .tag,#v100GradingCenter .tag,#v100GradingSubmitModal .tag{color:#ffd664}
.v100-skill{background:#111923!important;border-color:#2b3849!important;color:#f4f7fb!important}
.v100-skill.owned{background:#101c18!important;border-color:#4f7461!important}
.v100-skill.locked{background:#101720!important}
.v100-skill-head strong{color:#f4f7fb!important}.v100-skill-head b{color:#ffd664!important}
.v100-skill.owned .v100-skill-head b{color:#9fd6af!important}.v100-skill p{color:#9eabbb!important}
.v100-service{background:#111923!important;border-color:#2b3849!important;color:#f4f7fb!important}
.v100-service strong{color:#f4f7fb!important}.v100-service small{color:#9eabbb!important}
.v100-grading-row{color:#f4f7fb!important;border-color:#233040!important}.v100-grading-row strong{color:#f4f7fb!important}.v100-grading-row small{color:#9eabbb!important}
#v100ProgressionModal button.secondary,#v100GradingCenter button.secondary,#v100GradingSubmitModal button.secondary{color:#f4f7fb!important;background:#182331!important;border-color:#314157!important}
#v100ProgressionModal button.primary,#v100GradingCenter button.primary,#v100GradingSubmitModal button.primary{color:#121820!important;background:#f2bd34!important;border-color:#f2bd34!important}
#v100ProgressionModal button:disabled,#v100GradingCenter button:disabled,#v100GradingSubmitModal button:disabled{color:#718095!important;background:#151e2a!important;border-color:#263446!important;opacity:.72}
.v100-condition-card{color:#f4f7fb!important}.v100-condition-card strong,.v100-condition-card b{color:#f4f7fb!important}.v100-condition-grid{color:#9eabbb!important}.v100-condition-grid b{color:#f4f7fb!important}
/* The actual PSA slab label stays dark-on-white on purpose: it is a physical label, not app chrome. */
`;
document.head.appendChild(v101ThemeStyle);
window.__voxV101ThemeReady=true;
