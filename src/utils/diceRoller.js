function rollDice(diceString) { // Ej: "1d20", "2d6", "1d10+5"
  const cleanedString = diceString.toLowerCase().replace(/\s+/g, '');
  const match = cleanedString.match(/^(\d+)d(\d+)(?:([+-])(\d+))?$/);

  if (!match) {
      console.error(`Formato de dado inválido recibido: ${diceString}`);
      throw new Error(`Formato de dado inválido: ${diceString}. Use NroDadosDMaxLados[+Modificador], ej: 1d20, 2d6+3.`);
  }

  const numDice = parseInt(match[1]);
  const numSides = parseInt(match[2]);
  const operator = match[3];
  const modifierValue = parseInt(match[4]) || 0;

  if (numDice <= 0 || numSides <= 0) {
      throw new Error("El número de dados y caras debe ser positivo.");
  }
  if (numDice > 100) { // Límite para evitar abusos
      throw new Error("No se pueden tirar más de 100 dados a la vez.");
  }


  let total = 0;
  const rolls = [];
  for (let i = 0; i < numDice; i++) {
    const roll = Math.ceil(Math.random() * numSides);
    rolls.push(roll);
    total += roll;
  }

  let finalTotal = total;
  if (operator === '+') {
    finalTotal += modifierValue;
  } else if (operator === '-') {
    finalTotal -= modifierValue;
  }
  
  const modifierString = operator && modifierValue ? ` ${operator} ${modifierValue}` : "";
  const rollsString = `(${rolls.join(', ')})`;

  return {
    total: finalTotal, // Este es el resultado final incluyendo el modificador
    rolls,
    baseRollSum: total, // Suma de los dados antes del modificador
    modifier: operator && modifierValue ? (operator === '+' ? modifierValue : -modifierValue) : 0,
    toString: () => `${numDice}d${numSides}${modifierString} ${rollsString} = ${finalTotal}`
  };
}

module.exports = { rollDice };