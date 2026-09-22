#!/bin/bash
set -e

WASM_HOME_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DCMTK_HOME_DIR=$WASM_HOME_DIR/lib/dcmtk-3.7.0
DCMTK_OFICONV_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/oficonv/include
DCMTK_OFICONV_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/oficonv/libsrc
DCMTK_OFLOG_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/oflog/include
DCMTK_OFLOG_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/oflog/libsrc
DCMTK_OFSTD_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/ofstd/include
DCMTK_OFSTD_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/ofstd/libsrc
DCMTK_DCMDATA_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/dcmdata/include
DCMTK_DCMDATA_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/dcmdata/libsrc
DCMTK_DCMIMGLE_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/dcmimgle/include
DCMTK_DCMIMGLE_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/dcmimgle/libsrc
DCMTK_DCMIMAGE_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/dcmimage/include
DCMTK_DCMIMAGE_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/dcmimage/libsrc
DCMTK_DCMJPEG_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpeg/include
DCMTK_DCMJPEG_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpeg/libsrc
DCMTK_DCMJPEG_LIBIJG8_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpeg/libijg8
DCMTK_DCMJPEG_LIBIJG12_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpeg/libijg12
DCMTK_DCMJPEG_LIBIJG16_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpeg/libijg16
DCMTK_DCMJPLS_INCL_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpls/include
DCMTK_DCMJPLS_SCR_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpls/libsrc
DCMTK_DCMJPLS_LIBCHARLS_DIR=$DCMTK_HOME_DIR/dcmtk/dcmjpls/libcharls
OPENJPEG_SRC_DIR=$WASM_HOME_DIR/lib/openjpeg-2.5.0
OPENJPH_INCL_DIR=$WASM_HOME_DIR/lib/openjph-0.18.2/core/common
OPENJPH_SRC_DIR=$WASM_HOME_DIR/lib/openjph-0.18.2
ZLIB_SRC_DIR=$WASM_HOME_DIR/lib/zlib-1.3.1
DCMTK_CODEC_OPENJPEG_INCL_DIR=$WASM_HOME_DIR/src/Codecs/DcmtkJpeg2000/include
DCMTK_CODEC_OPENJPEG_SCR_DIR=$WASM_HOME_DIR/src/Codecs/DcmtkJpeg2000/libsrc
DCMTK_CODEC_OPENJPH_INCL_DIR=$WASM_HOME_DIR/src/Codecs/DcmtkHtJpeg2000/include
DCMTK_CODEC_OPENJPH_SCR_DIR=$WASM_HOME_DIR/src/Codecs/DcmtkHtJpeg2000/libsrc
WASM_SRC_DIR=$WASM_HOME_DIR/src

# names shared by the three IJG libjpeg forks (8/12/16-bit precision)
libijg_files=(
  jcapimin.c jcapistd.c jcarith.c jccoefct.c jccolor.c jcdctmgr.c jcdiffct.c
  jchuff.c jcinit.c jclhuff.c jclossls.c jclossy.c jcmainct.c jcmarker.c
  jcmaster.c jcodec.c jcomapi.c jcparam.c jcphuff.c jcpred.c jcprepct.c
  jcsample.c jcscale.c jcshuff.c jctrans.c jdapimin.c jdapistd.c jdarith.c
  jdatadst.c jdatasrc.c jdcoefct.c jdcolor.c jddctmgr.c jddiffct.c jdhuff.c
  jdinput.c jdlhuff.c jdlossls.c jdlossy.c jdmainct.c jdmarker.c jdmaster.c
  jdmerge.c jdphuff.c jdpostct.c jdpred.c jdsample.c jdscale.c jdshuff.c
  jdtrans.c jerror.c jfdctflt.c jfdctfst.c jfdctint.c jidctflt.c jidctfst.c
  jidctint.c jidctred.c jmemmgr.c jmemnobs.c jquant1.c jquant2.c jutils.c
)

c_files=(
  # openjpeg
  "$OPENJPEG_SRC_DIR/thread.c"
  "$OPENJPEG_SRC_DIR/bio.c"
  "$OPENJPEG_SRC_DIR/cio.c"
  "$OPENJPEG_SRC_DIR/dwt.c"
  "$OPENJPEG_SRC_DIR/event.c"
  "$OPENJPEG_SRC_DIR/ht_dec.c"
  "$OPENJPEG_SRC_DIR/image.c"
  "$OPENJPEG_SRC_DIR/invert.c"
  "$OPENJPEG_SRC_DIR/j2k.c"
  "$OPENJPEG_SRC_DIR/jp2.c"
  "$OPENJPEG_SRC_DIR/mct.c"
  "$OPENJPEG_SRC_DIR/mqc.c"
  "$OPENJPEG_SRC_DIR/openjpeg.c"
  "$OPENJPEG_SRC_DIR/opj_clock.c"
  "$OPENJPEG_SRC_DIR/pi.c"
  "$OPENJPEG_SRC_DIR/t1.c"
  "$OPENJPEG_SRC_DIR/t2.c"
  "$OPENJPEG_SRC_DIR/tcd.c"
  "$OPENJPEG_SRC_DIR/tgt.c"
  "$OPENJPEG_SRC_DIR/function_list.c"
  "$OPENJPEG_SRC_DIR/opj_malloc.c"
  "$OPENJPEG_SRC_DIR/sparse_array.c"

  # zlib
  "$ZLIB_SRC_DIR/adler32.c"
  "$ZLIB_SRC_DIR/compress.c"
  "$ZLIB_SRC_DIR/crc32.c"
  "$ZLIB_SRC_DIR/deflate.c"
  "$ZLIB_SRC_DIR/infback.c"
  "$ZLIB_SRC_DIR/inffast.c"
  "$ZLIB_SRC_DIR/inflate.c"
  "$ZLIB_SRC_DIR/inftrees.c"
  "$ZLIB_SRC_DIR/trees.c"
  "$ZLIB_SRC_DIR/uncompr.c"
  "$ZLIB_SRC_DIR/zutil.c"

  # oficonv
  "$DCMTK_OFICONV_SCR_DIR/citrus_bcs.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_bcs_strtol.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_bcs_strtoul.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_big5.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_csmapper.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_db.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_db_factory.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_db_hash.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_dechanyu.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_esdb.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_euc.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_euctw.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_gbk2k.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_hash.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_hz.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_iconv.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_iconv_none.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_iconv_std.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_iso2022.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_jisx0208.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_johab.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_lookup.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_lookup_factory.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mapper.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mapper_646.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mapper_none.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mapper_serial.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mapper_std.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mapper_zone.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_memstream.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mmap.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_module.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_mskanji.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_none.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_pivot_factory.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_prop.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_stdenc.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_ues.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_utf1632.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_utf7.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_utf8.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_viqr.c"
  "$DCMTK_OFICONV_SCR_DIR/citrus_zw.c"
  "$DCMTK_OFICONV_SCR_DIR/data_csmapper.c"
  "$DCMTK_OFICONV_SCR_DIR/data_esdb.c"
  "$DCMTK_OFICONV_SCR_DIR/oficonv_iconv.c"
  "$DCMTK_OFICONV_SCR_DIR/oficonv_logger.c"
  "$DCMTK_OFICONV_SCR_DIR/oficonv_strcasestr.c"
  "$DCMTK_OFICONV_SCR_DIR/oficonv_strlcpy.c"

  # dcmdata
  "$DCMTK_DCMDATA_SCR_DIR/vrscanl.c"
)
for f in "${libijg_files[@]}"; do
  c_files+=("$DCMTK_DCMJPEG_LIBIJG8_DIR/$f")
done
for f in "${libijg_files[@]}"; do
  c_files+=("$DCMTK_DCMJPEG_LIBIJG12_DIR/$f")
done
for f in "${libijg_files[@]}"; do
  c_files+=("$DCMTK_DCMJPEG_LIBIJG16_DIR/$f")
done

cpp_files=(
  # openjph
  "$OPENJPH_SRC_DIR/core/codestream/ojph_codeblock_fun.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_codeblock.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_codestream_gen.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_codestream_local.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_codestream.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_params.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_precinct.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_resolution.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_subband.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_tile_comp.cpp"
  "$OPENJPH_SRC_DIR/core/codestream/ojph_tile.cpp"
  "$OPENJPH_SRC_DIR/core/coding/ojph_block_common.cpp"
  "$OPENJPH_SRC_DIR/core/coding/ojph_block_decoder32.cpp"
  "$OPENJPH_SRC_DIR/core/coding/ojph_block_decoder64.cpp"
  "$OPENJPH_SRC_DIR/core/coding/ojph_block_encoder.cpp"
  "$OPENJPH_SRC_DIR/core/others/ojph_arch.cpp"
  "$OPENJPH_SRC_DIR/core/others/ojph_file.cpp"
  "$OPENJPH_SRC_DIR/core/others/ojph_mem.cpp"
  "$OPENJPH_SRC_DIR/core/others/ojph_message.cpp"
  "$OPENJPH_SRC_DIR/core/transform/ojph_colour.cpp"
  "$OPENJPH_SRC_DIR/core/transform/ojph_transform.cpp"

  # ofstd
  "$DCMTK_OFSTD_SCR_DIR/ofcmdln.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofconapp.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofcond.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofconfig.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofconsol.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofcrc32.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofdate.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofdatime.cc"
  "$DCMTK_OFSTD_SCR_DIR/oferror.cc"
  "$DCMTK_OFSTD_SCR_DIR/offile.cc"
  "$DCMTK_OFSTD_SCR_DIR/offname.cc"
  "$DCMTK_OFSTD_SCR_DIR/oflist.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofstd.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofstring.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofthread.cc"
  "$DCMTK_OFSTD_SCR_DIR/oftime.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofmath.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofuuid.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofsha256.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofrand.cc"
  "$DCMTK_OFSTD_SCR_DIR/ofchrenc.cc"

  # oflog
  "$DCMTK_OFLOG_SCR_DIR/apndimpl.cc"
  "$DCMTK_OFLOG_SCR_DIR/appender.cc"
  "$DCMTK_OFLOG_SCR_DIR/asyncap.cc"
  "$DCMTK_OFLOG_SCR_DIR/clogger.cc"
  "$DCMTK_OFLOG_SCR_DIR/config.cc"
  "$DCMTK_OFLOG_SCR_DIR/consap.cc"
  "$DCMTK_OFLOG_SCR_DIR/cygwin32.cc"
  "$DCMTK_OFLOG_SCR_DIR/env.cc"
  "$DCMTK_OFLOG_SCR_DIR/factory.cc"
  "$DCMTK_OFLOG_SCR_DIR/fileap.cc"
  "$DCMTK_OFLOG_SCR_DIR/fileinfo.cc"
  "$DCMTK_OFLOG_SCR_DIR/filter.cc"
  "$DCMTK_OFLOG_SCR_DIR/globinit.cc"
  "$DCMTK_OFLOG_SCR_DIR/hierarchy.cc"
  "$DCMTK_OFLOG_SCR_DIR/hierlock.cc"
  "$DCMTK_OFLOG_SCR_DIR/layout.cc"
  "$DCMTK_OFLOG_SCR_DIR/lloguser.cc"
  "$DCMTK_OFLOG_SCR_DIR/lockfile.cc"
  "$DCMTK_OFLOG_SCR_DIR/log4judp.cc"
  "$DCMTK_OFLOG_SCR_DIR/logevent.cc"
  "$DCMTK_OFLOG_SCR_DIR/logger.cc"
  "$DCMTK_OFLOG_SCR_DIR/logimpl.cc"
  "$DCMTK_OFLOG_SCR_DIR/loglevel.cc"
  "$DCMTK_OFLOG_SCR_DIR/loglog.cc"
  "$DCMTK_OFLOG_SCR_DIR/logmacro.cc"
  "$DCMTK_OFLOG_SCR_DIR/mdc.cc"
  "$DCMTK_OFLOG_SCR_DIR/ndc.cc"
  "$DCMTK_OFLOG_SCR_DIR/ntelogap.cc"
  "$DCMTK_OFLOG_SCR_DIR/nullap.cc"
  "$DCMTK_OFLOG_SCR_DIR/objreg.cc"
  "$DCMTK_OFLOG_SCR_DIR/oflog.cc"
  "$DCMTK_OFLOG_SCR_DIR/patlay.cc"
  "$DCMTK_OFLOG_SCR_DIR/pointer.cc"
  "$DCMTK_OFLOG_SCR_DIR/property.cc"
  "$DCMTK_OFLOG_SCR_DIR/queue.cc"
  "$DCMTK_OFLOG_SCR_DIR/rootlog.cc"
  "$DCMTK_OFLOG_SCR_DIR/sleep.cc"
  "$DCMTK_OFLOG_SCR_DIR/snprintf.cc"
  "$DCMTK_OFLOG_SCR_DIR/sockbuff.cc"
  "$DCMTK_OFLOG_SCR_DIR/socket.cc"
  "$DCMTK_OFLOG_SCR_DIR/socketap.cc"
  "$DCMTK_OFLOG_SCR_DIR/strccloc.cc"
  "$DCMTK_OFLOG_SCR_DIR/strcloc.cc"
  "$DCMTK_OFLOG_SCR_DIR/strhelp.cc"
  "$DCMTK_OFLOG_SCR_DIR/striconv.cc"
  "$DCMTK_OFLOG_SCR_DIR/syncprims.cc"
  "$DCMTK_OFLOG_SCR_DIR/syslogap.cc"
  "$DCMTK_OFLOG_SCR_DIR/threads.cc"
  "$DCMTK_OFLOG_SCR_DIR/timehelp.cc"
  "$DCMTK_OFLOG_SCR_DIR/tls.cc"
  "$DCMTK_OFLOG_SCR_DIR/unixsock.cc"
  "$DCMTK_OFLOG_SCR_DIR/version.cc"

  # dcmdata
  "$DCMTK_DCMDATA_SCR_DIR/cmdlnarg.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcbytstr.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcchrstr.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dccodec.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcdatset.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcddirif.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcdicdir.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcdicent.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcdict.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcdictbi.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcdirrec.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcelem.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcerror.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcfilefo.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dchashdi.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcistrma.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcistrmb.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcistrmf.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcistrmz.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcitem.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dclist.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcmetinf.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcobject.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcostrma.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcostrmb.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcostrmf.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcostrmz.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcpath.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcpcache.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcpixel.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcpixseq.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcpxitem.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcrleccd.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcrlecce.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcrlecp.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcrledrg.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcrleerg.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcrlerp.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcsequen.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcstack.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcswap.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dctag.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dctagkey.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dctypes.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcuid.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrae.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvras.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrat.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvr.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrcs.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrda.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrds.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrdt.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrfd.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrfl.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvris.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrlo.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrlt.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrobow.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrof.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrod.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrol.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrov.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrsv.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvruc.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrur.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvruv.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrpn.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrpobw.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrsh.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrsl.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrss.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrst.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrtm.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrui.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrul.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrulup.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrus.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcvrut.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcwcache.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcxfer.cc"
  "$DCMTK_DCMDATA_SCR_DIR/vrscan.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcjson.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcmatch.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcistrms.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcostrms.cc"
  "$DCMTK_DCMDATA_SCR_DIR/dcspchrs.cc"

  # dcmimgle
  "$DCMTK_DCMIMGLE_SCR_DIR/dcmimage.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dibaslut.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diciefn.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dicielut.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/didislut.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/didispfn.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/didocu.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/digsdfn.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/digsdlut.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diimage.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diinpx.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diluptab.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimo1img.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimo2img.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimoimg.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimoimg3.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimoimg4.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimoimg5.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimomod.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimoopx.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/dimopx.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diovdat.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diovlay.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diovlimg.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diovpln.cc"
  "$DCMTK_DCMIMGLE_SCR_DIR/diutils.cc"

  # dcmimage
  "$DCMTK_DCMIMAGE_SCR_DIR/dcmicmph.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diargimg.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dicmyimg.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dicoimg.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dicoopx.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dicopx.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dihsvimg.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dilogger.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dipalimg.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dipipng.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dipitiff.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diqtctab.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diqtfs.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diqthash.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diqthitl.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diqtpbox.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diquant.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diregist.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/dirgbimg.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diybrimg.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diyf2img.cc"
  "$DCMTK_DCMIMAGE_SCR_DIR/diyp2img.cc"

  # dcmjpeg
  "$DCMTK_DCMJPEG_SCR_DIR/ddpiimpl.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/dipijpeg.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djcodecd.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djcodece.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djcparam.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdecbas.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdecext.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdeclol.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdecode.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdecpro.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdecsps.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdecsv1.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdijg12.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdijg16.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djdijg8.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djeijg12.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djeijg16.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djeijg8.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djencbas.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djencext.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djenclol.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djencode.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djencpro.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djencsps.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djencsv1.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djrplol.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djrploss.cc"
  "$DCMTK_DCMJPEG_SCR_DIR/djutils.cc"

  # dcmjpls
  "$DCMTK_DCMJPLS_SCR_DIR/dipijpls.cc"
  "$DCMTK_DCMJPLS_SCR_DIR/djcodecd.cc"
  "$DCMTK_DCMJPLS_SCR_DIR/djcodece.cc"
  "$DCMTK_DCMJPLS_SCR_DIR/djcparam.cc"
  "$DCMTK_DCMJPLS_SCR_DIR/djdecode.cc"
  "$DCMTK_DCMJPLS_SCR_DIR/djencode.cc"
  "$DCMTK_DCMJPLS_SCR_DIR/djrparam.cc"
  "$DCMTK_DCMJPLS_SCR_DIR/djutils.cc"
  "$DCMTK_DCMJPLS_LIBCHARLS_DIR/header.cc"
  "$DCMTK_DCMJPLS_LIBCHARLS_DIR/intrface.cc"
  "$DCMTK_DCMJPLS_LIBCHARLS_DIR/jpegls.cc"

  # codecs
  "$DCMTK_CODEC_OPENJPH_SCR_DIR/djcodecd.cc"
  "$DCMTK_CODEC_OPENJPH_SCR_DIR/djcodece.cc"
  "$DCMTK_CODEC_OPENJPH_SCR_DIR/djcparam.cc"
  "$DCMTK_CODEC_OPENJPH_SCR_DIR/djdecode.cc"
  "$DCMTK_CODEC_OPENJPH_SCR_DIR/djencode.cc"
  "$DCMTK_CODEC_OPENJPH_SCR_DIR/djrparam.cc"
  "$DCMTK_CODEC_OPENJPH_SCR_DIR/djutils.cc"

  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/djcodecd.cc"
  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/djcodece.cc"
  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/djcparam.cc"
  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/djdecode.cc"
  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/djencode.cc"
  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/djrparam.cc"
  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/djutils.cc"
  "$DCMTK_CODEC_OPENJPEG_SCR_DIR/memory_file.cpp"

  "$WASM_SRC_DIR/Bmp.cpp"
  "$WASM_SRC_DIR/Dcmtk.cpp"
  "$WASM_SRC_DIR/DcmtkContext.cpp"
  "$WASM_SRC_DIR/Exception.cpp"
  "$WASM_SRC_DIR/Message.cpp")

include_directories=(
  "-I$WASM_SRC_DIR"
  "-I$DCMTK_HOME_DIR"
  "-I$DCMTK_HOME_DIR/dcmtk"
  "-I$OPENJPEG_SRC_DIR"
  "-I$OPENJPH_INCL_DIR"
  "-I$ZLIB_SRC_DIR"
  "-I$DCMTK_CODEC_OPENJPEG_INCL_DIR"
  "-I$DCMTK_CODEC_OPENJPH_INCL_DIR"
  "-I$DCMTK_OFICONV_INCL_DIR"
  "-I$DCMTK_OFLOG_INCL_DIR"
  "-I$DCMTK_OFSTD_INCL_DIR"
  "-I$DCMTK_DCMDATA_INCL_DIR"
  "-I$DCMTK_DCMIMGLE_INCL_DIR"
  "-I$DCMTK_DCMIMAGE_INCL_DIR"
  "-I$DCMTK_DCMJPEG_INCL_DIR"
  "-I$DCMTK_DCMJPEG_LIBIJG8_DIR"
  "-I$DCMTK_DCMJPEG_LIBIJG12_DIR"
  "-I$DCMTK_DCMJPEG_LIBIJG16_DIR"
  "-I$DCMTK_DCMJPLS_INCL_DIR"
  "-I$DCMTK_DCMJPLS_LIBCHARLS_DIR"
)

suppress_warnings=(
  "-Wno-implicit-const-int-float-conversion"
  "-Wno-deprecated-register"
)

definitions=(
  "-DJSON_NO_IO"
  "-DHAVE_CONFIG_H"
  "-DDCMTK_LOG4CPLUS_DISABLE_FATAL"
  "-DDCM_DICT_DEFAULT=1"
  "-DDCMTK_ENABLE_BUILTIN_OFICONV_DATA"
)

mkdir -p ./bin
OBJ_DIR="$WASM_HOME_DIR/obj"
mkdir -p "$OBJ_DIR"

common_flags=(
  "${include_directories[@]}" "${suppress_warnings[@]}" "${definitions[@]}"
  # Without this, a throw not caught within the same function compiles to an
  # abort ("unreachable" trap) instead of unwinding to the JS caller. Native
  # Wasm exception handling is used since it needs no extra JS runtime glue
  # (unlike the legacy JS-based model, which requires the __cxa_* ABI).
  "-fwasm-exceptions"   # Link-time optimization enables cross-TU inlining and typically reduces both
   # binary size and runtime. Must be present at both compile and link time.
   "-flto")
obj_files=()

# Compiling every source individually (rather than one combined emcc invocation)
# ensures C sources are actually compiled as C: emcc applies -x/-std flags to all
# inputs of an invocation regardless of their position, so C and C++ sources must
# be compiled with separate invocations to get correct language semantics.
compile_file() {
  local src="$1"
  shift
  local objname
  objname="$OBJ_DIR/$(echo "$src" | sed 's#[/.]#_#g').o"
  if [ ! -f "$objname" ] || [ "$src" -nt "$objname" ]; then
    local extra_defs=()
    # oflog's internal headers refuse to compile outside of its own library sources
    case "$src" in
    "$DCMTK_OFLOG_SCR_DIR"/*) extra_defs+=("-DDCMTK_INSIDE_LOG4CPLUS") ;;
    esac
    echo "CC      $src"
    emcc -Werror -O3 "$@" "${extra_defs[@]}" -c "$src" "${common_flags[@]}" -o "$objname"
  else
    echo "CACHED  $src"
  fi
  obj_files+=("$objname")
}

echo "Compiling ${#c_files[@]} C sources..."
for f in "${c_files[@]}"; do
  compile_file "$f" -std=gnu11
done

echo "Compiling ${#cpp_files[@]} C++ sources..."
for f in "${cpp_files[@]}"; do
  compile_file "$f" -std=c++14
done

echo "Linking..."
emcc --no-entry "${obj_files[@]}" \
  -s EXPORTED_FUNCTIONS=[] \
  -s TOTAL_MEMORY=32MB \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s FILESYSTEM=0 \
  -fwasm-exceptions \
  -flto \
  -o ./bin/dcmtk-wasm.wasm
