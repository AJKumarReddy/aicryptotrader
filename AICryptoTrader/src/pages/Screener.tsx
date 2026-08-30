import React, { useState, useEffect } from "react";
import VCListSidebar, { VC } from "@/components/screener/VCListSidebar";
import VCHoldingsTable from "@/components/screener/VCHoldingsTable";
import { SidebarProvider } from "@/components/ui/sidebar";

// Add wallet as a VC-like entry
const WALLET: VC = { id: "alameda-wallet", name: "Alameda Research (Wallet)" };
const WALLET_ADDRESS = "0x3507e4978e0Eb83315D20dF86CA0b976c0E40CcB";
const WALLET_CHAIN = "eth-mainnet"; // Ethereum Mainnet

const MOCK_VCS: VC[] = [
  WALLET, // Show wallet as first option for visibility
  { id: "multicoin", name: "Multicoin Capital" },
  { id: "coinbase", name: "Coinbase Ventures" },
  { id: "a16z", name: "a16z (Andreessen Horowitz)" },
  { id: "paradigm", name: "Paradigm" },
  { id: "binance", name: "Binance Labs" },
  { id: "polychain", name: "Polychain Capital" },
];

const MOCK_HOLDINGS: Record<string, { symbol: string; name: string; amount: number }[]> = {
  multicoin: [
    { symbol: "SOL", name: "Solana", amount: 120000 },
    { symbol: "LDO", name: "Lido DAO", amount: 500000 },
    { symbol: "MANTA", name: "Manta Network", amount: 20000 },
  ],
  coinbase: [
    { symbol: "UNI", name: "Uniswap", amount: 80000 },
    { symbol: "MATIC", name: "Polygon", amount: 150000 },
    { symbol: "OP", name: "Optimism", amount: 34000 },
  ],
  a16z: [
    { symbol: "FIL", name: "Filecoin", amount: 400000 },
    { symbol: "APE", name: "ApeCoin", amount: 120000 },
    { symbol: "ARB", name: "Arbitrum", amount: 55000 },
  ],
  paradigm: [
    { symbol: "ETH", name: "Ethereum", amount: 3400 },
    { symbol: "DYDX", name: "dYdX", amount: 72000 },
    { symbol: "BLUR", name: "Blur", amount: 200000 },
  ],
  binance: [
    { symbol: "BNB", name: "Binance Coin", amount: 110000 },
    { symbol: "SUI", name: "Sui", amount: 55000 },
    { symbol: "AVAX", name: "Avalanche", amount: 95000 },
  ],
  polychain: [
    { symbol: "DOT", name: "Polkadot", amount: 72000 },
    { symbol: "NEAR", name: "Near Protocol", amount: 95000 },
    { symbol: "CANTO", name: "Canto", amount: 125000 },
  ],
};

type WalletAsset = {
  symbol: string;
  name: string;
  amount: number;
};

const Screener = () => {
  const [selectedVCId, setSelectedVCId] = useState<string>(MOCK_VCS[0].id);
  const [walletAssets, setWalletAssets] = useState<WalletAsset[] | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  const selectedVC = MOCK_VCS.find((vc) => vc.id === selectedVCId);

  // Fetch wallet data when the wallet is selected
  useEffect(() => {
    if (selectedVCId !== WALLET.id) return;
    setWalletAssets(null);
    setWalletLoading(true);
    setWalletError(null);

    // Covalent API example (public, throttled)
    // See: https://www.covalenthq.com/docs/api/#/0/Get-balance-for-address-GET-v1-chain_id-address-balances_v2/
    const COVALENT_API = `https://api.covalenthq.com/v1/eth-mainnet/address/${WALLET_ADDRESS}/balances_v2/?no-nft=true&quote-currency=USD`;
    // Public demo key is "ckey_demo", which is safe for frontend demo.
    fetch(COVALENT_API + "&key=ckey_demo")
      .then((res) => res.json())
      .then((data) => {
        if (!data || !data.data || !Array.isArray(data.data.items)) {
          throw new Error("No data found");
        }
        // Map to compatible array
        const assets: WalletAsset[] = data.data.items
          .filter((token: any) => Number(token.balance) > 0 && (token.contract_ticker_symbol || token.contract_name))
          .map((token: any) => ({
            symbol: token.contract_ticker_symbol || "-",
            name: token.contract_name || "-",
            amount:
              Number(token.balance) /
              Math.pow(10, token.contract_decimals ?? 0),
          }))
          // Only show assets with non-negligible balance
          .filter((asset) => asset.amount > 0.001)
          .sort((a, b) => b.amount - a.amount);

        setWalletAssets(assets);
      })
      .catch((err) => {
        console.error("Wallet fetch error", err);
        setWalletError("Failed to fetch wallet assets.");
      })
      .finally(() => {
        setWalletLoading(false);
      });
  }, [selectedVCId]);

  // Holdings selecting logic
  const holdings =
    selectedVCId === WALLET.id
      ? walletAssets || []
      : selectedVC
      ? MOCK_HOLDINGS[selectedVC.id] || []
      : [];

  // Name handling
  const vcName =
    selectedVCId === WALLET.id
      ? `${WALLET.name} - ${WALLET_ADDRESS.slice(0, 6)}...${WALLET_ADDRESS.slice(-4)}`
      : selectedVC?.name || "";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-black text-white">
        <VCListSidebar
          vcs={MOCK_VCS}
          selectedVCId={selectedVCId}
          onSelectVC={setSelectedVCId}
        />
        <main className="flex-1 flex flex-col items-center justify-start pt-24 px-4 sm:px-12 bg-black/90 min-h-screen overflow-auto">
          <h1 className="text-3xl sm:text-4xl font-bold mb-8 bg-gradient-to-r from-red-400 via-yellow-400 to-red-400 bg-clip-text text-transparent">
            VC Token Holdings Screener
          </h1>
          {selectedVC && (
            <>
              {selectedVCId === WALLET.id && walletLoading && (
                <div className="my-8 text-lg text-yellow-300">Loading wallet assets...</div>
              )}
              {selectedVCId === WALLET.id && walletError && (
                <div className="my-8 text-lg text-red-400">{walletError}</div>
              )}
              <VCHoldingsTable vcName={vcName} holdings={holdings} />
            </>
          )}
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Screener;
