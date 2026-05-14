import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

const footballLeagues = [
  "La Liga", "La Liga 2", "Premier League", "Championship",
  "Serie A", "Serie B", "Bundesliga", "Ligue 1",
  "Champions League", "Europa League", "Conference League",
  "Copa del Rey", "FA Cup", "Copa Libertadores", "Copa del Mundo"
];

const otherLeagues: Record<string, string[]> = {
  Basket: ["NBA", "Euroliga", "ACB", "FIBA"],
  Tenis: ["ATP", "WTA", "Grand Slam", "Davis Cup"],
  Otros: ["NFL", "NHL", "MLB", "UFC", "Boxeo", "E-Sports"],
};

const topLeaguesBySport: Record<string, string[]> = {
  Futbol: ["La Liga", "Premier League", "Champions League", "Serie A", "Bundesliga"],
  Basket: ["NBA", "Euroliga", "ACB", "FIBA"],
  Tenis: ["ATP", "WTA", "Grand Slam", "Davis Cup"],
  Otros: ["NFL", "NHL", "MLB", "UFC", "Boxeo"],
};

interface CompetitionSelectorProps {
  value: string;
  onChange: (value: string) => void;
  sport?: string;
  placeholder?: string;
  testId?: string;
}

export function CompetitionSelector({
  value,
  onChange,
  sport = "Futbol",
  placeholder = "Seleccionar o escribir...",
  testId = "input-competition"
}: CompetitionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allLeagues = sport === "Futbol" ? footballLeagues : otherLeagues[sport] || [];
  const sportTopLeagues = topLeaguesBySport[sport] || allLeagues.slice(0, 5);

  const filteredLeagues = inputValue.trim()
    ? allLeagues.filter(league => 
        league.toLowerCase().includes(inputValue.toLowerCase())
      )
    : sportTopLeagues;

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleSelect = (league: string) => {
    setInputValue(league);
    onChange(league);
    setIsOpen(false);
  };

  const handleClear = () => {
    setInputValue("");
    onChange("");
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative group">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-3.5 pr-16 text-sm text-white outline-none transition-all placeholder-zinc-500 focus:ring-2 focus:ring-[#B0FB5D] sm:p-4"
          data-testid={testId}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {inputValue && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-zinc-500 hover:text-white transition-colors"
              data-testid={`${testId}-clear`}
            >
              <X size={16} />
            </button>
          )}
          <div className="pointer-events-none text-zinc-500">
            <ChevronDown size={20} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
          <ul className="max-h-[min(18rem,50dvh)] overflow-y-auto">
            {filteredLeagues.length > 0 ? (
              filteredLeagues.map((league) => (
                <li key={league}>
                  <button
                    type="button"
                    onClick={() => handleSelect(league)}
                    className="w-full px-4 py-3.5 text-left text-sm text-white transition-colors hover:bg-zinc-800"
                    data-testid={`${testId}-option-${league.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {league}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-4 py-3 text-zinc-500 text-sm">
                Sin resultados. Escribe para añadir una nueva.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
