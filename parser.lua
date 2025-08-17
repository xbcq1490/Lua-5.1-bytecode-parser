local Byte = string.byte
local Sub = string.sub

local function gBit(Bit, Start, End)
	if End then
		local Res = (Bit / 2 ^ (Start - 1)) % 2 ^ ((End - 1) - (Start - 1) + 1)
		return Res - Res % 1
	else
		local Plc = 2 ^ (Start - 1)
		if (Bit % (Plc + Plc) >= Plc) then
			return 1
		else
			return 0
		end
	end
end

local function ParseBytecode(ByteString)
	local Pos = 1

	local function gBits8()
		local F = Byte(ByteString, Pos, Pos)
		Pos = Pos + 1
		return F
	end

	local function gBits32()
		local W, X, Y, Z = Byte(ByteString, Pos, Pos + 3)
		Pos = Pos + 4
		return (Z * 16777216) + (Y * 65536) + (X * 256) + W
	end

	local function gBits64()
		local a, b, c, d, e, f, g, h = Byte(ByteString, Pos, Pos + 7)
		Pos = Pos + 8
		return h * 72057594037927936 + g * 281474976710656 + f * 1099511627776 + e * 4294967296 + d * 16777216 + c * 65536 + b * 256 + a
	end

	-- Header
	assert(Sub(ByteString, 1, 4) == "\27Lua", "Lua bytecode expected."); Pos = 5
	assert(gBits8() == 0x51, "Only Lua 5.1 is supported.")
	gBits8() -- format version
	assert(gBits8() == 1, "Little endian is expected.")
	local intSize = gBits8()
	local size_tSize = gBits8()
	gBits8() -- instruction size
	gBits8() -- number size
	gBits8() -- integral flag

	local gInt = (intSize == 4 and gBits32 or gBits64)
	local gSizet = (size_tSize == 4 and gBits32 or gBits64)

	local function gString(Len)
		local Str
		Len = Len or gSizet()
		if (Len == 0) then return "" end
		Str = Sub(ByteString, Pos, Pos + Len - 1)
		Pos = Pos + Len
		return Str
	end

	local function ChunkDecode()
		local Chunk = {}
		Chunk.Name = gString(gSizet())
		Chunk.FirstL = gInt()
		Chunk.LastL = gInt()
		Chunk.Upvals = gBits8()
		Chunk.Args = gBits8()
		Chunk.Vargs = gBits8()
		Chunk.Stack = gBits8()

		local numInstructions = gInt()
		Chunk.Instr = {}
		for i = 1, numInstructions do
			local Data = gBits32()
			local Opco = gBit(Data, 1, 6)
			Chunk.Instr[i] = { Enum = Opco, Value = Data }
		end

		local numConstants = gInt()
		Chunk.Const = {}
		for i = 1, numConstants do
			local Type = gBits8()
			if Type == 1 then
				Chunk.Const[i] = (gBits8() ~= 0)
			elseif Type == 3 then
				Pos = Pos + 8
			elseif Type == 4 then
				Chunk.Const[i] = gString(gSizet())
			end
		end

		local numPrototypes = gInt()
		Chunk.Proto = {}
		for i = 1, numPrototypes do
			Chunk.Proto[i] = ChunkDecode()
		end

		return Chunk
	end

	return ChunkDecode()
end

return { ParseBytecode }
