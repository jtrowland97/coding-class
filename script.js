// Step 1: Find the button and help box from our HTML page
const helpButton = document.querySelector('#help-btn');
const helpBox = document.querySelector('#help-box');
// Step 2: Listen for button clicks and toggle the help box
helpButton.addEventListener('click', function() {
  // classList.toggle adds 'hidden' if it's missing, or removes it if it's there!
  helpBox.classList.toggle('hidden');
  console.log(helpBox);
  console.log(helpButton);
// Step 3: Our JSON Data Envelope (DTO)
const termData = {
  term: "DTO (Data Transfer Object)",
  definition: "A digital envelope used to neatly carry simple text or numbers between computer systems without extra code.",
  author: "Technical Communication Handbook"
};

// Find the term button and card box
const loadTermBtn = document.querySelector('#load-term-btn');
const termCard = document.querySelector('#term-card');

// When clicked, unpack the JSON data and put it on screen!
loadTermBtn.addEventListener('click', function() {
  termCard.innerHTML = `
    <h3 class="font-bold text-slate-900 text-sm mb-1">${termData.term}</h3>
    <p class="text-slate-700 text-xs mb-2">${termData.definition}</p>
    <span class="text-[10px] text-blue-600 font-semibold uppercase tracking-wider block">Source: ${termData.author}</span>
  `;
});
  
});