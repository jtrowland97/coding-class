import React, { useState } from 'react';

export default function CoffeeOrder() {
  const [shots, setShots] = useState(1);
  return (
 <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md border">
      <h1 className="text-xl font-bold">☕ Café Customizer</h1>

      <div className="flex items-center space-x-3 my-4">
        <span>Espresso Shots: {shots}</span>
        <button onClick={() => setShots(shots - 1)} disabled={shots <= 1}>-</button>
        <button onClick={() => setShots(shots + 1)}>+</button>
      </div>
    </div>
  );
}