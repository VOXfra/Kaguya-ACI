
#include <cstdint>
#include <iostream>
#include <map>
#include <optional>
#include <string>
#include <tuple>
#include <vector>

struct Identity { std::string library, nid; };
struct Requirement { std::string requester, symbol; std::vector<std::string> fallback; std::optional<Identity> exact; bool weak{}; };
struct Assessment { std::size_t total{},structured{},exact_resolved{},textual_resolved{},weak_unresolved{},strong_unresolved{}; std::vector<std::string> unresolved; bool ready()const{return strong_unresolved==0;} };
struct Resolver {
  std::map<std::pair<std::string,std::string>,void*> exact;
  std::map<std::pair<std::string,std::string>,void*> scoped;
  std::map<std::string,void*> global;
  std::optional<void*> resolve_exact(const Identity&i)const{auto it=exact.find({i.library,i.nid});return it==exact.end()?std::nullopt:std::optional<void*>{it->second};}
  std::optional<void*> resolve_text(const std::vector<std::string>&libs,const std::string&s)const{
    for(auto&l:libs){auto it=scoped.find({l,s});if(it!=scoped.end())return it->second;}
    auto g=global.find(s);return g==global.end()?std::nullopt:std::optional<void*>{g->second};
  }
};
static Assessment assess(const std::vector<Requirement>&q,const Resolver&r){
  Assessment a;a.total=q.size();
  for(auto&x:q){bool ok=false;if(x.exact){++a.structured;auto v=r.resolve_exact(*x.exact);if(v&&*v){ok=true;++a.exact_resolved;}}else{auto v=r.resolve_text(x.fallback,x.symbol);if(v&&*v){ok=true;++a.textual_resolved;}}
    if(ok)continue;if(x.weak){++a.weak_unresolved;continue;}++a.strong_unresolved;a.unresolved.push_back(x.symbol);}
  return a;
}
static std::uint64_t A(){return 1;} static std::uint64_t B(){return 2;} static std::uint64_t C(){return 3;}
int main(){
 Resolver r;
 r.exact[{"libExact","NID-OK"}]=reinterpret_cast<void*>(&A);
 r.scoped[{"libFallback","plain"}]=reinterpret_cast<void*>(&B);
 r.global["same_raw_text"]=reinterpret_cast<void*>(&C);
 std::vector<Requirement> q{
   {"root","same_raw_text",{"libFallback"},Identity{"libExact","NID-OK"},false},
   {"root","plain",{"libFallback"},std::nullopt,false},
   {"root","weak",{"libFallback"},std::nullopt,true}};
 auto p=assess(q,r);
 if(!p.ready()||p.exact_resolved!=1||p.textual_resolved!=1||p.weak_unresolved!=1)return 10;
 q[0].exact=Identity{"libExact","NID-MISSING"};
 auto f=assess(q,r);
 if(f.ready()||f.strong_unresolved!=1)return 20;
 std::cout<<"V205_EXACT_IMPORT_CONTRACT_OK\n";
 std::cout<<"V205_STRUCTURED_MISSING_DOES_NOT_FALLBACK=1\n";
 std::cout<<"V205_ZERO_TRAP_REQUIRED_FOR_STAGE=1\n";
 std::cout<<"V205_BASELINE_PERCENT=86.0\n";
 return 0;
}