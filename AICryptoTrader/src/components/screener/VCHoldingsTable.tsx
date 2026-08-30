
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TrendingUp } from "lucide-react";

type Holding = {
  symbol: string;
  name: string;
  amount: number;
};

type VCHoldingsTableProps = {
  vcName: string;
  holdings: Holding[];
};

const VCHoldingsTable: React.FC<VCHoldingsTableProps> = ({ vcName, holdings }) => {
  return (
    <Card className="bg-gradient-to-br from-black/60 to-gray-900/80 border-gray-700/40 w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TrendingUp className="text-red-400" />
          {vcName}'s Token Holdings
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-white">Token</TableHead>
              <TableHead className="text-white">Symbol</TableHead>
              <TableHead className="text-white text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-gray-400 py-8">
                  No holdings for this VC.
                </TableCell>
              </TableRow>
            ) : (
              holdings.map((holding) => (
                <TableRow key={holding.symbol}>
                  <TableCell className="text-white">{holding.name}</TableCell>
                  <TableCell className="text-white">{holding.symbol}</TableCell>
                  <TableCell className="text-white text-right">{holding.amount.toLocaleString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default VCHoldingsTable;
