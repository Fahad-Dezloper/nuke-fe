#!/usr/bin/env python3
"""
lighter-go main currently has wasm/main.go out of sync with types/: integrator
fields live on types.L2TxAttributes via TransactOpts.TxAttributes, not on
CreateOrderTxReq / ModifyOrderTxReq. Patch wasm so `go build` succeeds.

Idempotent: skips if the legacy struct fields are already absent.
"""

from __future__ import annotations

import pathlib
import sys


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: fix-lighter-go-wasm-integrator.py <path/to/lighter-go/wasm/main.go>", file=sys.stderr)
        return 2

    path = pathlib.Path(sys.argv[1])
    text = path.read_text(encoding="utf-8")

    if "IntegratorAccountIndex: int(integratorAccountIndex)" not in text:
        print(f"[lighter:wasm] skip integrator patch (already applied or different upstream): {path}")
        return 0

    old_create = """\t\t\ttxInfo := &types.CreateOrderTxReq{
\t\t\t\tMarketIndex:            int16(marketIndex),
\t\t\t\tClientOrderIndex:       clientOrderIndex,
\t\t\t\tBaseAmount:             baseAmount,
\t\t\t\tPrice:                  price,
\t\t\t\tIsAsk:                  isAsk,
\t\t\t\tType:                   orderType,
\t\t\t\tTimeInForce:            timeInForce,
\t\t\t\tReduceOnly:             reduceOnly,
\t\t\t\tTriggerPrice:           triggerPrice,
\t\t\t\tOrderExpiry:            orderExpiry,
\t\t\t\tIntegratorAccountIndex: int(integratorAccountIndex),
\t\t\t\tIntegratorTakerFee:     int(integratorTakerFee),
\t\t\t\tIntegratorMakerFee:     int(integratorMakerFee),
\t\t\t}
\t\t\tops := new(types.TransactOpts)
\t\t\tif nonce != -1 {
\t\t\t\tops.Nonce = &nonce
\t\t\t}

\t\t\ttx, err := c.GetCreateOrderTransaction(txInfo, ops)"""

    new_create = """\t\t\ttxInfo := &types.CreateOrderTxReq{
\t\t\t\tMarketIndex:            int16(marketIndex),
\t\t\t\tClientOrderIndex:       clientOrderIndex,
\t\t\t\tBaseAmount:             baseAmount,
\t\t\t\tPrice:                  price,
\t\t\t\tIsAsk:                  isAsk,
\t\t\t\tType:                   orderType,
\t\t\t\tTimeInForce:            timeInForce,
\t\t\t\tReduceOnly:             reduceOnly,
\t\t\t\tTriggerPrice:           triggerPrice,
\t\t\t\tOrderExpiry:            orderExpiry,
\t\t\t}
\t\t\tops := new(types.TransactOpts)
\t\t\tiaCreate := int64(integratorAccountIndex)
\t\t\titCreate := uint32(integratorTakerFee)
\t\t\timCreate := uint32(integratorMakerFee)
\t\t\tops.TxAttributes = &types.L2TxAttributes{
\t\t\t\tIntegratorAccountIndex: &iaCreate,
\t\t\t\tIntegratorTakerFee:     &itCreate,
\t\t\t\tIntegratorMakerFee:     &imCreate,
\t\t\t}
\t\t\tif nonce != -1 {
\t\t\t\tops.Nonce = &nonce
\t\t\t}

\t\t\ttx, err := c.GetCreateOrderTransaction(txInfo, ops)"""

    if old_create not in text:
        print(f"[lighter:wasm] integrator patch: CreateOrder block not found (upstream changed?): {path}", file=sys.stderr)
        return 1

    text = text.replace(old_create, new_create, 1)

    old_modify = """\t\t\ttxInfo := &types.ModifyOrderTxReq{
\t\t\t\tMarketIndex:            marketIndex,
\t\t\t\tIndex:                  index,
\t\t\t\tBaseAmount:             baseAmount,
\t\t\t\tPrice:                  price,
\t\t\t\tTriggerPrice:           triggerPrice,
\t\t\t\tIntegratorAccountIndex: integratorAccountIndex,
\t\t\t\tIntegratorTakerFee:     integratorTakerFee,
\t\t\t\tIntegratorMakerFee:     integratorMakerFee,
\t\t\t}
\t\t\tops := new(types.TransactOpts)
\t\t\tif nonce != -1 {
\t\t\t\tops.Nonce = &nonce
\t\t\t}

\t\t\ttx, err := c.GetModifyOrderTransaction(txInfo, ops)"""

    new_modify = """\t\t\ttxInfo := &types.ModifyOrderTxReq{
\t\t\t\tMarketIndex:            marketIndex,
\t\t\t\tIndex:                  index,
\t\t\t\tBaseAmount:             baseAmount,
\t\t\t\tPrice:                  price,
\t\t\t\tTriggerPrice:           triggerPrice,
\t\t\t}
\t\t\tops := new(types.TransactOpts)
\t\t\tiaMod := int64(integratorAccountIndex)
\t\t\titMod := uint32(integratorTakerFee)
\t\t\timMod := uint32(integratorMakerFee)
\t\t\tops.TxAttributes = &types.L2TxAttributes{
\t\t\t\tIntegratorAccountIndex: &iaMod,
\t\t\t\tIntegratorTakerFee:     &itMod,
\t\t\t\tIntegratorMakerFee:     &imMod,
\t\t\t}
\t\t\tif nonce != -1 {
\t\t\t\tops.Nonce = &nonce
\t\t\t}

\t\t\ttx, err := c.GetModifyOrderTransaction(txInfo, ops)"""

    if old_modify not in text:
        print(f"[lighter:wasm] integrator patch: ModifyOrder block not found: {path}", file=sys.stderr)
        return 1

    text = text.replace(old_modify, new_modify, 1)

    old_grouped_order = """\t\t\t\torders[i] = &types.CreateOrderTxReq{
\t\t\t\t\tMarketIndex:            int16(orderObj.Get("MarketIndex").Int()),
\t\t\t\t\tClientOrderIndex:       int64(orderObj.Get("ClientOrderIndex").Int()),
\t\t\t\t\tBaseAmount:             int64(orderObj.Get("BaseAmount").Int()),
\t\t\t\t\tPrice:                  uint32(orderObj.Get("Price").Int()),
\t\t\t\t\tIsAsk:                  uint8(orderObj.Get("IsAsk").Int()),
\t\t\t\t\tType:                   uint8(orderObj.Get("Type").Int()),
\t\t\t\t\tTimeInForce:            uint8(orderObj.Get("TimeInForce").Int()),
\t\t\t\t\tReduceOnly:             uint8(orderObj.Get("ReduceOnly").Int()),
\t\t\t\t\tTriggerPrice:           uint32(orderObj.Get("TriggerPrice").Int()),
\t\t\t\t\tOrderExpiry:            orderExpiry,
\t\t\t\t\tIntegratorAccountIndex: int(orderObj.Get("IntegratorAccountIndex").Int()),
\t\t\t\t\tIntegratorTakerFee:     int(orderObj.Get("IntegratorTakerFee").Int()),
\t\t\t\t\tIntegratorMakerFee:     int(orderObj.Get("IntegratorMakerFee").Int()),
\t\t\t\t}"""

    new_grouped_order = """\t\t\t\torders[i] = &types.CreateOrderTxReq{
\t\t\t\t\tMarketIndex:            int16(orderObj.Get("MarketIndex").Int()),
\t\t\t\t\tClientOrderIndex:       int64(orderObj.Get("ClientOrderIndex").Int()),
\t\t\t\t\tBaseAmount:             int64(orderObj.Get("BaseAmount").Int()),
\t\t\t\t\tPrice:                  uint32(orderObj.Get("Price").Int()),
\t\t\t\t\tIsAsk:                  uint8(orderObj.Get("IsAsk").Int()),
\t\t\t\t\tType:                   uint8(orderObj.Get("Type").Int()),
\t\t\t\t\tTimeInForce:            uint8(orderObj.Get("TimeInForce").Int()),
\t\t\t\t\tReduceOnly:             uint8(orderObj.Get("ReduceOnly").Int()),
\t\t\t\t\tTriggerPrice:           uint32(orderObj.Get("TriggerPrice").Int()),
\t\t\t\t\tOrderExpiry:            orderExpiry,
\t\t\t\t}"""

    if old_grouped_order not in text:
        print(f"[lighter:wasm] integrator patch: grouped order block not found: {path}", file=sys.stderr)
        return 1

    text = text.replace(old_grouped_order, new_grouped_order, 1)

    old_grouped_ops = """\t\t\treq := &types.CreateGroupedOrdersTxReq{
\t\t\t\tGroupingType: groupingType,
\t\t\t\tOrders:       orders,
\t\t\t}
\t\t\tops := new(types.TransactOpts)
\t\t\tif nonce != -1 {
\t\t\t\tops.Nonce = &nonce
\t\t\t}

\t\t\ttxInfo, err := c.GetCreateGroupedOrdersTransaction(req, ops)"""

    new_grouped_ops = """\t\t\treq := &types.CreateGroupedOrdersTxReq{
\t\t\t\tGroupingType: groupingType,
\t\t\t\tOrders:       orders,
\t\t\t}
\t\t\tops := new(types.TransactOpts)
\t\t\tif length > 0 {
\t\t\t\tfirst := ordersArg.Index(0)
\t\t\t\tiaG := int64(first.Get("IntegratorAccountIndex").Int())
\t\t\t\titG := uint32(first.Get("IntegratorTakerFee").Int())
\t\t\t\timG := uint32(first.Get("IntegratorMakerFee").Int())
\t\t\t\tops.TxAttributes = &types.L2TxAttributes{
\t\t\t\t\tIntegratorAccountIndex: &iaG,
\t\t\t\t\tIntegratorTakerFee:     &itG,
\t\t\t\t\tIntegratorMakerFee:     &imG,
\t\t\t\t}
\t\t\t}
\t\t\tif nonce != -1 {
\t\t\t\tops.Nonce = &nonce
\t\t\t}

\t\t\ttxInfo, err := c.GetCreateGroupedOrdersTransaction(req, ops)"""

    if old_grouped_ops not in text:
        print(f"[lighter:wasm] integrator patch: grouped ops block not found: {path}", file=sys.stderr)
        return 1

    text = text.replace(old_grouped_ops, new_grouped_ops, 1)

    path.write_text(text, encoding="utf-8")
    print(f"[lighter:wasm] applied wasm integrator → TxAttributes patch: {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
