package main

import (
	"reflect"
	"testing"
)

func TestPhoneCandidates(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want []string
	}{
		{"BR celular sem DDI", "(11) 99999-8888", []string{"5511999998888", "551199998888", "11999998888"}},
		{"BR fixo sem DDI", "11 3333-4444", []string{"551133334444", "5511933334444", "1133334444"}},
		{"BR com DDI", "5511999998888", []string{"5511999998888", "551199998888"}},
		{"BR com +55", "+55 84 99999-8888", []string{"5584999998888", "558499998888"}},
		{"BR com tronco 0", "011 99999-8888", []string{"5511999998888", "551199998888", "011999998888"}},
		{"EUA com +", "+1 (212) 555-1234", []string{"12125551234"}},
		{"EUA sem +", "1 212 555 1234", []string{"12125551234"}},
		{"Portugal com 00", "00351 912 345 678", []string{"351912345678"}},
		{"Portugal sem +", "351912345678", []string{"351912345678"}},
		{"Reino Unido", "+44 7911 123456", []string{"447911123456"}},
		{"Argentina", "+54 9 11 2345-6789", []string{"5491123456789"}},
		{"Chile sem +", "56912345678", []string{"56912345678"}},
		{"Peru sem + (ambiguo com Porto Alegre)", "51987654321", []string{"5551987654321", "555187654321", "51987654321"}},
		{"vazio", "  ", nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := phoneCandidates(tc.in)
			if !reflect.DeepEqual(got, tc.want) {
				t.Errorf("phoneCandidates(%q) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}
